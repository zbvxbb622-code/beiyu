import json
import logging
import traceback
from collections.abc import Callable, Generator
from uuid import uuid4

import httpx
import pytest
from pydantic import SecretStr

from app.core.config import AiProvider as AiProviderName
from app.core.config import Settings
from app.db.models import AiMemoryCategory, AiSafetyLabel
from app.integrations.ai import (
    AiProviderInvalidResponse,
    AiProviderTimeout,
    AiProviderUnavailable,
    AliyunAiProvider,
    DevelopmentAiProvider,
    get_ai_provider,
    get_ai_provider_dependency,
)
from app.integrations.ai.development import (
    DEVELOPMENT_TIMEOUT_TRIGGER,
    DEVELOPMENT_UNAVAILABLE_TRIGGER,
    DEVELOPMENT_UNSAFE_OUTPUT_TRIGGER,
)
from app.modules.ai.context import serialize_generation_request
from app.modules.ai.schemas import (
    AiGenerationMessage,
    AiGenerationRequest,
    AiRecipeCandidate,
)

API_KEY = "test-api-key-that-must-never-appear"
BASE_URL = "https://dashscope.aliyuncs.com/compatible-mode/v1/"
MODEL = "qwen-plus"
PRIVATE_INPUT = "我的私密输入绝不能进入日志"


def generation_request(
    content: str = "今天有点难过，想先聊聊。",
    *,
    recipes: list[AiRecipeCandidate] | None = None,
) -> AiGenerationRequest:
    return AiGenerationRequest(
        system_prompt="你是温柔、自然的朋友型调酒师。",
        messages=[AiGenerationMessage(role="user", content=content)],
        memories=["偏好清爽、低甜"],
        cellar_ingredient_ids=["gin"],
        candidate_recipes=recipes or [],
        max_output_chars=8000,
        context_text="已经由 Task9 裁剪的上下文",
    )


def settings(*, provider: AiProviderName = AiProviderName.DEVELOPMENT) -> Settings:
    values: dict[str, object] = {
        "database_url": "postgresql+psycopg://user:pass@db/beiyu",
        "ai_provider": provider,
    }
    if provider is AiProviderName.ALIYUN:
        values.update(
            ai_model=MODEL,
            ai_base_url=BASE_URL,
            ai_api_key=SecretStr(API_KEY),
        )
    return Settings.model_validate(values)


def completion_response(*, content: object) -> httpx.Response:
    return httpx.Response(
        200,
        json={
            "id": "cmpl-test-request",
            "choices": [{"message": {"content": content}}],
            "usage": {"prompt_tokens": 12, "completion_tokens": 7},
        },
        headers={"x-request-id": "req-test-123"},
    )


def mock_client(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.Client:
    return httpx.Client(transport=httpx.MockTransport(handler))


def exception_surface(exception: BaseException) -> str:
    seen: set[int] = set()
    parts: list[str] = []

    def visit(current: BaseException | None) -> None:
        if current is None or id(current) in seen:
            return
        seen.add(id(current))
        parts.extend(
            (
                str(current),
                repr(current),
                "".join(traceback.format_exception(current)),
            )
        )
        visit(current.__cause__)
        visit(current.__context__)

    visit(exception)
    return "\n".join(parts)


def test_development_provider_is_byte_for_byte_deterministic() -> None:
    provider = DevelopmentAiProvider(model="development-test-model")
    request = generation_request()

    first = provider.generate(request)
    second = provider.generate(request)

    assert first.model_dump_json() == second.model_dump_json()
    assert first.provider == "development"
    assert first.model == "development-test-model"


def test_development_provider_acknowledges_emotion_before_advice() -> None:
    result = DevelopmentAiProvider().generate(generation_request("今天很难过，不知道怎么办。"))

    first_sentence, advice = result.reply_text.split("。", maxsplit=1)
    assert "难过" in first_sentence
    assert "可以" in advice
    assert result.recipe_ids == []


def test_development_provider_returns_only_server_candidate_recipe_ids_for_explicit_drink_intent() -> None:
    candidate = AiRecipeCandidate(
        id=uuid4(),
        name="清爽金汤力",
        description="低甜清爽",
        tags=["清爽"],
    )
    result = DevelopmentAiProvider().generate(
        generation_request("请推荐一杯清爽的饮品。", recipes=[candidate])
    )

    assert result.recipe_ids == [candidate.id]
    assert set(result.recipe_ids).issubset({candidate.id})


def test_development_provider_memory_candidates_are_stable_and_exclude_redacted_input() -> None:
    provider = DevelopmentAiProvider()
    preference_request = generation_request("我喜欢清爽、低甜的味道。")

    assert provider.generate(preference_request).memory_candidates == provider.generate(
        preference_request
    ).memory_candidates
    assert provider.generate(
        generation_request("[用户消息含敏感身份信息，未提供给模型]")
    ).memory_candidates == []


@pytest.mark.parametrize(
    ("trigger", "exception"),
    [
        (DEVELOPMENT_TIMEOUT_TRIGGER, AiProviderTimeout),
        (DEVELOPMENT_UNAVAILABLE_TRIGGER, AiProviderUnavailable),
    ],
)
def test_development_provider_test_only_failure_triggers(trigger: str, exception: type[Exception]) -> None:
    with pytest.raises(exception):
        DevelopmentAiProvider().generate(generation_request(trigger))


def test_development_provider_test_only_unsafe_output_trigger_is_not_reviewed() -> None:
    result = DevelopmentAiProvider().generate(generation_request(DEVELOPMENT_UNSAFE_OUTPUT_TRIGGER))

    assert result.safety_label is AiSafetyLabel.SAFE
    assert "麻痹" in result.reply_text


def test_provider_factory_returns_a_fresh_provider_for_each_validated_settings_instance() -> None:
    configured = settings()

    first = get_ai_provider(configured)
    second = get_ai_provider(configured)

    assert isinstance(first, DevelopmentAiProvider)
    assert isinstance(second, DevelopmentAiProvider)
    assert first is not second


def test_provider_factory_rejects_unknown_provider_without_configuration_details() -> None:
    configured = settings()
    object.__setattr__(configured, "ai_provider", "unknown")

    with pytest.raises(AiProviderUnavailable) as exc_info:
        get_ai_provider(configured)

    assert API_KEY not in str(exc_info.value)


def test_aliyun_provider_uses_canonical_payload_and_exact_transport_contract() -> None:
    recipe_id = uuid4()
    received: list[httpx.Request] = []
    request = generation_request(
        PRIVATE_INPUT,
        recipes=[
            AiRecipeCandidate(
                id=recipe_id,
                name="金汤力",
                description="清爽",
                tags=["清爽"],
            )
        ],
    )
    structured_content = {
        "replyText": "听起来今天不容易。我们可以先慢一点，再看看你想喝什么。",
        "recipeIds": [str(recipe_id)],
        "memoryCandidates": [],
        "safetyLabel": "SAFE",
    }

    def handler(http_request: httpx.Request) -> httpx.Response:
        received.append(http_request)
        return completion_response(content=json.dumps(structured_content))

    with mock_client(handler) as client:
        provider = AliyunAiProvider(
            base_url=BASE_URL,
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=client,
        )
        result = provider.generate(request)

    assert len(received) == 1
    sent = received[0]
    assert str(sent.url) == "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions"
    assert sent.headers["authorization"] == f"Bearer {API_KEY}"
    assert sent.headers["content-type"] == "application/json"
    assert sent.extensions["timeout"] == {
        "connect": 20.0,
        "read": 20.0,
        "write": 20.0,
        "pool": 20.0,
    }
    payload = json.loads(sent.content)
    assert payload["model"] == MODEL
    assert payload["messages"][1] == {
        "role": "user",
        "content": serialize_generation_request(request),
    }
    assert "replyText" in payload["messages"][0]["content"]
    assert payload["response_format"] == {"type": "json_object"}
    assert payload["enable_thinking"] is False
    assert payload["max_tokens"] == 900
    assert payload["stream"] is False
    assert result.recipe_ids == [recipe_id]
    assert result.input_tokens == 12
    assert result.output_tokens == 7


@pytest.mark.parametrize("status_code", [401, 429, 500, 503, 418])
def test_aliyun_provider_maps_non_success_statuses_without_leaking_response_body(
    status_code: int,
) -> None:
    secret_response_body = "provider response must stay private"

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(status_code, text=secret_response_body)

    with mock_client(handler) as client:
        provider = AliyunAiProvider(
            base_url=BASE_URL,
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=client,
        )
        with pytest.raises(AiProviderUnavailable) as exc_info:
            provider.generate(generation_request(PRIVATE_INPUT))

    message = str(exc_info.value)
    assert API_KEY not in message
    assert PRIVATE_INPUT not in message
    assert secret_response_body not in message


@pytest.mark.parametrize(
    "response",
    [
        httpx.Response(200, content=b"not-json"),
        completion_response(content={"replyText": 123}),
        httpx.Response(200, json={"choices": []}),
        httpx.Response(200, json={"choices": [{"message": {}}]}),
        completion_response(content='{"recipeIds": []}'),
    ],
)
def test_aliyun_provider_rejects_invalid_compatible_response(response: httpx.Response) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return response

    with mock_client(handler) as client:
        provider = AliyunAiProvider(
            base_url=BASE_URL,
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=client,
        )
        with pytest.raises(AiProviderInvalidResponse) as exc_info:
            provider.generate(generation_request(PRIVATE_INPUT))

    assert API_KEY not in str(exc_info.value)
    assert PRIVATE_INPUT not in str(exc_info.value)


def test_aliyun_invalid_response_does_not_retain_malicious_response_in_exception_graph(
    caplog: pytest.LogCaptureFixture,
) -> None:
    malicious_value = f"{PRIVATE_INPUT}::{API_KEY}"
    response = completion_response(
        content=json.dumps(
            {
                "replyText": "看起来正常",
                "recipeIds": [{"untrusted": malicious_value}],
            }
        )
    )
    caplog.set_level(logging.INFO)

    with mock_client(lambda _: response) as client:
        provider = AliyunAiProvider(
            base_url=BASE_URL,
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=client,
        )
        with pytest.raises(AiProviderInvalidResponse) as exc_info:
            provider.generate(generation_request(PRIVATE_INPUT))

    surface = exception_surface(exc_info.value)
    assert exc_info.value.__cause__ is None
    assert exc_info.value.__context__ is None
    assert malicious_value not in surface
    assert API_KEY not in surface
    assert PRIVATE_INPUT not in surface
    assert malicious_value not in caplog.text
    assert API_KEY not in caplog.text
    assert PRIVATE_INPUT not in caplog.text


def test_aliyun_provider_maps_connect_and_read_timeouts() -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("upstream did not respond")

    with mock_client(handler) as client:
        provider = AliyunAiProvider(
            base_url=BASE_URL,
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=client,
        )
        with pytest.raises(AiProviderTimeout):
            provider.generate(generation_request())


def test_aliyun_provider_rejects_non_https_and_path_confusion() -> None:
    with pytest.raises(ValueError, match="HTTPS"):
        AliyunAiProvider(
            base_url="http://example.test/v1",
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=mock_client(lambda _: completion_response(content="{}")),
        )
    with pytest.raises(ValueError, match="query"):
        AliyunAiProvider(
            base_url="https://example.test/v1?target=evil",
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=mock_client(lambda _: completion_response(content="{}")),
        )
    with pytest.raises(ValueError, match="compatible-mode"):
        AliyunAiProvider(
            base_url="https://example.test/compatible-mode/v1/chat/completions",
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=mock_client(lambda _: completion_response(content="{}")),
        )


@pytest.mark.parametrize(
    "base_url",
    [
        "https://evil.example/compatible-mode/v1",
        "https://dashscope.aliyuncs.com.evil/compatible-mode/v1",
        "https://dashscope.aliyuncs.com/compatible-mode/%2e%2e/v1",
        "https://dashscope.aliyuncs.com/compatible-mode%2fv1",
        "https://api@dashscope.aliyuncs.com/compatible-mode/v1",
        "https://dashscope.aliyuncs.com:8443/compatible-mode/v1",
        "https://dashscope.aliyuncs.com/compatible-mode/v1/extra",
    ],
)
def test_aliyun_provider_rejects_untrusted_base_urls_before_sending_key(base_url: str) -> None:
    received: list[httpx.Request] = []

    with mock_client(lambda request: received.append(request) or completion_response(content="{}")) as client:
        with pytest.raises(ValueError):
            AliyunAiProvider(
                base_url=base_url,
                api_key=SecretStr(API_KEY),
                model=MODEL,
                client=client,
            )

    assert received == []


def test_aliyun_provider_canonicalizes_an_official_workspace_base_url() -> None:
    provider = AliyunAiProvider(
        base_url="https://WORKSPACE-42.cn-beijing.maas.aliyuncs.com:443/compatible-mode/v1/",
        api_key=SecretStr(API_KEY),
        model=MODEL,
        client=mock_client(lambda _: completion_response(content="{}")),
    )

    assert provider._url == (
        "https://workspace-42.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions"
    )


def test_aliyun_logs_only_operational_metadata(
    caplog: pytest.LogCaptureFixture,
) -> None:
    response_body = "full provider response must never be logged"

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(503, text=response_body, headers={"x-request-id": "req-private"})

    caplog.set_level(logging.INFO)
    with mock_client(handler) as client:
        provider = AliyunAiProvider(
            base_url=BASE_URL,
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=client,
        )
        with pytest.raises(AiProviderUnavailable):
            provider.generate(generation_request(PRIVATE_INPUT))

    logged = caplog.text
    assert "req-private" in logged
    assert "503" in logged
    assert API_KEY not in logged
    assert PRIVATE_INPUT not in logged
    assert response_body not in logged


def test_aliyun_accepts_structured_content_and_non_negative_usage_metadata() -> None:
    response = completion_response(
        content={
            "replyText": "我在这里，慢慢说。",
            "recipeIds": [],
            "memoryCandidates": [
                {
                    "category": AiMemoryCategory.EMOTIONAL_PREFERENCE.value,
                    "memoryKey": "prefers-listening",
                    "summary": "希望先被倾听",
                    "confidence": 0.8,
                    "sensitive": False,
                }
            ],
            "safetyLabel": AiSafetyLabel.SAFE.value,
        }
    )

    with mock_client(lambda _: response) as client:
        result = AliyunAiProvider(
            base_url=BASE_URL,
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=client,
        ).generate(generation_request())

    assert result.memory_candidates[0].category is AiMemoryCategory.EMOTIONAL_PREFERENCE
    assert result.input_tokens == 12
    assert result.output_tokens == 7
    assert result.cost_estimate is None
    assert all(value is None or value >= 0 for value in (result.input_tokens, result.output_tokens, result.cost_estimate))


def test_aliyun_normalizes_lowercase_safety_label_from_compatible_models() -> None:
    response = completion_response(
        content=json.dumps(
            {
                "replyText": "你好呀，先从一杯清爽的金汤力开始吧。",
                "recipeIds": [],
                "memoryCandidates": [],
                "safetyLabel": "safe",
            }
        )
    )

    with mock_client(lambda _: response) as client:
        result = AliyunAiProvider(
            base_url=BASE_URL,
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=client,
        ).generate(generation_request())

    assert result.safety_label is AiSafetyLabel.SAFE


def test_aliyun_rejects_negative_usage_metadata() -> None:
    response = httpx.Response(
        200,
        json={
            "choices": [{"message": {"content": '{"replyText":"hello"}'}}],
            "usage": {"prompt_tokens": -1, "completion_tokens": 0},
        },
    )

    with mock_client(lambda _: response) as client:
        with pytest.raises(AiProviderInvalidResponse):
            AliyunAiProvider(
                base_url=BASE_URL,
                api_key=SecretStr(API_KEY),
                model=MODEL,
                client=client,
            ).generate(generation_request())


def test_aliyun_trigger_text_is_sent_to_transport_not_interpreted_locally() -> None:
    received: list[httpx.Request] = []

    def handler(http_request: httpx.Request) -> httpx.Response:
        received.append(http_request)
        return completion_response(content='{"replyText":"transport called"}')

    with mock_client(handler) as client:
        result = AliyunAiProvider(
            base_url=BASE_URL,
            api_key=SecretStr(API_KEY),
            model=MODEL,
            client=client,
        ).generate(generation_request(DEVELOPMENT_TIMEOUT_TRIGGER))

    assert len(received) == 1
    assert result.reply_text == "transport called"


def test_aliyun_owned_client_closes_after_dependency_request_and_is_idempotent(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[httpx.Client] = []
    real_client = httpx.Client

    def client_factory(*, timeout: float) -> httpx.Client:
        client = real_client(
            timeout=timeout,
            transport=httpx.MockTransport(
                lambda _: completion_response(content='{"replyText":"closed"}')
            ),
        )
        created.append(client)
        return client

    monkeypatch.setattr("app.integrations.ai.aliyun.httpx.Client", client_factory)
    dependency = get_ai_provider_dependency(settings(provider=AiProviderName.ALIYUN))
    assert isinstance(dependency, Generator)

    provider = next(dependency)
    assert provider.generate(generation_request()).reply_text == "closed"
    dependency.close()
    dependency.close()

    assert len(created) == 1
    assert created[0].is_closed


def test_aliyun_owned_client_closes_after_dependency_exception(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[httpx.Client] = []
    real_client = httpx.Client

    def client_factory(*, timeout: float) -> httpx.Client:
        client = real_client(
            timeout=timeout,
            transport=httpx.MockTransport(lambda _: completion_response(content="not-json")),
        )
        created.append(client)
        return client

    monkeypatch.setattr("app.integrations.ai.aliyun.httpx.Client", client_factory)
    dependency = get_ai_provider_dependency(settings(provider=AiProviderName.ALIYUN))
    provider = next(dependency)

    with pytest.raises(AiProviderInvalidResponse):
        provider.generate(generation_request())
    dependency.close()

    assert len(created) == 1
    assert created[0].is_closed


def test_injected_client_remains_caller_owned_and_development_has_no_resource() -> None:
    injected = mock_client(lambda _: completion_response(content='{"replyText":"caller owns"}'))
    provider = get_ai_provider(settings(provider=AiProviderName.ALIYUN), client=injected)

    assert isinstance(provider, AliyunAiProvider)
    provider.close()
    provider.close()
    assert not injected.is_closed
    assert not hasattr(get_ai_provider(settings(), client=injected), "close")
    injected.close()
