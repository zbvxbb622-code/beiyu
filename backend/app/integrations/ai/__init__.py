from typing import Annotated

from fastapi import Depends

from app.core.config import AiProvider as AiProviderName
from app.core.config import Settings, get_settings
from app.integrations.ai.aliyun import AliyunAiProvider
from app.integrations.ai.base import (
    AiProvider,
    AiProviderInvalidResponse,
    AiProviderTimeout,
    AiProviderUnavailable,
)
from app.integrations.ai.development import DevelopmentAiProvider


def get_ai_provider(settings: Settings) -> AiProvider:
    """Return a fresh, caller-owned provider instance for validated settings."""
    if settings.ai_provider is AiProviderName.DEVELOPMENT:
        return DevelopmentAiProvider(model=settings.ai_model)
    if settings.ai_provider is AiProviderName.ALIYUN:
        if settings.ai_base_url is None or settings.ai_api_key is None:
            raise AiProviderUnavailable("AI provider is not configured")
        return AliyunAiProvider(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key,
            model=settings.ai_model,
        )
    raise AiProviderUnavailable("AI provider is not configured")


def get_ai_provider_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> AiProvider:
    return get_ai_provider(settings)


__all__ = [
    "AiProvider",
    "AiProviderInvalidResponse",
    "AiProviderTimeout",
    "AiProviderUnavailable",
    "AliyunAiProvider",
    "DevelopmentAiProvider",
    "get_ai_provider",
    "get_ai_provider_dependency",
]
