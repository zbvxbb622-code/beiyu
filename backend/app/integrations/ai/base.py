from typing import Protocol

from app.modules.ai.schemas import AiGenerationRequest, AiGenerationResult


class AiProviderUnavailable(RuntimeError):
    """The configured provider cannot serve a request without exposing vendor details."""


class AiProviderTimeout(AiProviderUnavailable):
    """The configured provider did not respond before the adapter deadline."""


class AiProviderInvalidResponse(RuntimeError):
    """The configured provider returned a response outside the generation contract."""


class AiProvider(Protocol):
    def generate(self, request: AiGenerationRequest) -> AiGenerationResult: ...
