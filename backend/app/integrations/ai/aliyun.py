import json
import logging
import time
from collections.abc import Mapping
from typing import Any, cast

import httpx
from pydantic import SecretStr, ValidationError

from app.core.config import canonical_aliyun_base_url
from app.integrations.ai.base import (
    AiProviderInvalidResponse,
    AiProviderTimeout,
    AiProviderUnavailable,
)
from app.modules.ai.context import serialize_generation_request
from app.modules.ai.schemas import AiGenerationRequest, AiGenerationResult

logger = logging.getLogger(__name__)
REQUEST_TIMEOUT_SECONDS = 20.0
STRUCTURED_OUTPUT_INSTRUCTION = (
    "Return only a JSON object with replyText, recipeIds, memoryCandidates, and safetyLabel."
)


class AliyunAiProvider:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: SecretStr,
        model: str,
        client: httpx.Client | None = None,
    ) -> None:
        self._url = self._chat_completions_url(base_url)
        self._api_key = api_key.get_secret_value()
        self._model = model
        self._client = client or httpx.Client(timeout=REQUEST_TIMEOUT_SECONDS)
        self._owns_client = client is None

    def __enter__(self) -> "AliyunAiProvider":
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def close(self) -> None:
        if self._owns_client:
            self._client.close()
            self._owns_client = False

    def generate(self, request: AiGenerationRequest) -> AiGenerationResult:
        started_at = time.perf_counter()
        response: httpx.Response | None = None
        try:
            response = self._client.post(
                self._url,
                headers={
                    "Authorization": f"Bearer {self._api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self._model,
                    "messages": [
                        {"role": "system", "content": STRUCTURED_OUTPUT_INSTRUCTION},
                        {"role": "user", "content": serialize_generation_request(request)},
                    ],
                    "stream": False,
                },
                timeout=REQUEST_TIMEOUT_SECONDS,
            )
        except httpx.TimeoutException as exc:
            self._log(response=None, started_at=started_at)
            raise AiProviderTimeout("AI provider timed out") from exc
        except httpx.RequestError as exc:
            self._log(response=None, started_at=started_at)
            raise AiProviderUnavailable("AI provider unavailable") from exc

        self._log(response=response, started_at=started_at)
        if not response.is_success:
            raise AiProviderUnavailable("AI provider unavailable")
        return self._parse_response(response)

    @staticmethod
    def _chat_completions_url(base_url: str) -> str:
        return canonical_aliyun_base_url(base_url).rstrip("/") + "/chat/completions"

    def _parse_response(self, response: httpx.Response) -> AiGenerationResult:
        try:
            payload = response.json()
            content = self._choice_content(payload)
            structured = json.loads(content) if isinstance(content, str) else content
            if not isinstance(structured, Mapping):
                raise ValueError("structured content is not an object")
            result_payload: dict[str, Any] = dict(structured)
            result_payload.update(
                provider="aliyun",
                model=self._model,
                **self._usage(payload),
            )
            return AiGenerationResult.model_validate(result_payload)
        except (json.JSONDecodeError, KeyError, TypeError, ValidationError, ValueError):
            pass
        raise AiProviderInvalidResponse("AI provider returned an invalid response")

    @staticmethod
    def _choice_content(payload: object) -> str | Mapping[str, object]:
        if not isinstance(payload, Mapping):
            raise ValueError("response is not an object")
        choices = payload.get("choices")
        if not isinstance(choices, list) or not choices or not isinstance(choices[0], Mapping):
            raise ValueError("response choices are invalid")
        message = choices[0].get("message")
        if not isinstance(message, Mapping):
            raise ValueError("response message is invalid")
        content = message.get("content")
        if not isinstance(content, (str, Mapping)):
            raise ValueError("response content is invalid")
        return content if isinstance(content, str) else cast(Mapping[str, object], content)

    @staticmethod
    def _usage(payload: object) -> dict[str, object]:
        if not isinstance(payload, Mapping) or "usage" not in payload:
            return {}
        usage = cast(Mapping[str, object], payload)["usage"]
        if not isinstance(usage, Mapping):
            raise ValueError("response usage is invalid")
        values = {
            "input_tokens": usage.get("prompt_tokens"),
            "output_tokens": usage.get("completion_tokens"),
            "cost_estimate": usage.get("cost_estimate"),
        }
        return {key: value for key, value in values.items() if value is not None}

    def _log(self, *, response: httpx.Response | None, started_at: float) -> None:
        latency_ms = max(0, round((time.perf_counter() - started_at) * 1_000))
        logger.info(
            "ai_provider_call provider=aliyun model=%s request_id=%s status=%s latency_ms=%s",
            self._model,
            response.headers.get("x-request-id") if response is not None else None,
            response.status_code if response is not None else None,
            latency_ms,
        )
