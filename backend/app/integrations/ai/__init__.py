from collections.abc import Generator
from typing import Annotated

import httpx
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


def get_ai_provider(
    settings: Settings,
    *,
    client: httpx.Client | None = None,
) -> AiProvider:
    """Return a fresh provider; injected HTTP clients always remain caller-owned."""
    if settings.ai_provider is AiProviderName.DEVELOPMENT:
        return DevelopmentAiProvider(model=settings.ai_model)
    if settings.ai_provider is AiProviderName.ALIYUN:
        if settings.ai_base_url is None or settings.ai_api_key is None:
            raise AiProviderUnavailable("AI provider is not configured")
        return AliyunAiProvider(
            base_url=settings.ai_base_url,
            api_key=settings.ai_api_key,
            model=settings.ai_model,
            client=client,
        )
    raise AiProviderUnavailable("AI provider is not configured")


def get_ai_provider_dependency(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Generator[AiProvider, None, None]:
    provider = get_ai_provider(settings)
    try:
        yield provider
    finally:
        if isinstance(provider, AliyunAiProvider):
            provider.close()


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
