from app.core.config import DEVELOPMENT_AI_MODEL
from app.db.models import AiMemoryCategory, AiSafetyLabel
from app.integrations.ai.base import AiProviderTimeout, AiProviderUnavailable
from app.modules.ai.context import serialize_generation_request
from app.modules.ai.schemas import (
    AiGenerationRequest,
    AiGenerationResult,
    AiMemoryCandidate,
)

# These opaque values exist only to exercise failure paths in provider tests.
DEVELOPMENT_TIMEOUT_TRIGGER = "__BEIYU_TEST_ONLY_TIMEOUT_7fbd7bd1__"
DEVELOPMENT_UNAVAILABLE_TRIGGER = "__BEIYU_TEST_ONLY_UNAVAILABLE_7fbd7bd1__"
DEVELOPMENT_UNSAFE_OUTPUT_TRIGGER = "__BEIYU_TEST_ONLY_UNSAFE_OUTPUT_7fbd7bd1__"
REDACTED_INPUT_MARKER = "[用户消息含敏感身份信息，未提供给模型]"

_EMOTIONS = ("难过", "烦", "累", "焦虑", "失落", "委屈", "不安")
_DRINK_INTENT = ("饮品", "鸡尾酒", "酒谱", "配方", "推荐一杯", "喝什么")


class DevelopmentAiProvider:
    def __init__(self, *, model: str = DEVELOPMENT_AI_MODEL) -> None:
        self._model = model

    def generate(self, request: AiGenerationRequest) -> AiGenerationResult:
        content = request.messages[-1].content
        if content == DEVELOPMENT_TIMEOUT_TRIGGER:
            raise AiProviderTimeout("AI provider timed out")
        if content == DEVELOPMENT_UNAVAILABLE_TRIGGER:
            raise AiProviderUnavailable("AI provider unavailable")

        reply = self._reply(content)
        recipe_ids = (
            [request.candidate_recipes[0].id]
            if self._has_drink_intent(content) and request.candidate_recipes
            else []
        )
        return AiGenerationResult(
            reply_text=reply,
            recipe_ids=recipe_ids,
            memory_candidates=self._memory_candidates(content),
            provider="development",
            model=self._model,
            input_tokens=self._token_count(serialize_generation_request(request)),
            output_tokens=self._token_count(reply),
            cost_estimate=0,
            safety_label=AiSafetyLabel.SAFE,
        )

    @staticmethod
    def _token_count(content: str) -> int:
        return max(1, (len(content.encode("utf-8")) + 3) // 4)

    @staticmethod
    def _has_drink_intent(content: str) -> bool:
        return any(intent in content for intent in _DRINK_INTENT)

    @staticmethod
    def _memory_candidates(content: str) -> list[AiMemoryCandidate]:
        if content == REDACTED_INPUT_MARKER or not ("喜欢" in content or "偏好" in content):
            return []
        if "清爽" in content and "低甜" in content:
            return [
                AiMemoryCandidate(
                    category=AiMemoryCategory.DRINK_PREFERENCE,
                    memory_key="taste:crisp-low-sugar",
                    summary="偏好清爽、低甜的饮品",
                    confidence=0.9,
                    sensitive=False,
                )
            ]
        return []

    @staticmethod
    def _reply(content: str) -> str:
        if content == DEVELOPMENT_UNSAFE_OUTPUT_TRIGGER:
            return "喝酒能麻痹痛苦。"
        emotion = next((emotion for emotion in _EMOTIONS if emotion in content), None)
        if emotion is not None:
            return f"听起来你今天有些{emotion}。我们可以先慢一点，等你准备好再说说最在意的那件事。"
        if DevelopmentAiProvider._has_drink_intent(content):
            return "我明白你想找一杯合适的饮品。可以先从候选酒谱里挑一杯清爽、低甜的方向。"
        return "我在，慢慢说就好。你可以从此刻最想说的一点开始。"
