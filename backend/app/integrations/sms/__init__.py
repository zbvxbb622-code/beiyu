from app.core.config import Settings
from app.core.config import SmsProvider as SmsProviderName
from app.integrations.sms.base import SmsProvider
from app.integrations.sms.development import DevelopmentSmsProvider


def get_sms_provider(settings: Settings) -> SmsProvider:
    if settings.sms_provider is SmsProviderName.DEVELOPMENT:
        return DevelopmentSmsProvider(code=settings.sms_development_code)
    raise RuntimeError("cloud SMS provider is not configured")


__all__ = [
    "DevelopmentSmsProvider",
    "SmsProvider",
    "get_sms_provider",
]
