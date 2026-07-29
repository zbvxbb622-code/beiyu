import pytest

from app.core.config import Settings, SmsProvider
from app.integrations.sms import DevelopmentSmsProvider, get_sms_provider


def test_development_provider_uses_fixed_code_without_network_state() -> None:
    provider = DevelopmentSmsProvider(code="123456")

    assert provider.create_code() == "123456"
    assert (
        provider.send_code(
            phone="+8613800138000",
            code="123456",
            expires_minutes=5,
        )
        is None
    )
    assert vars(provider) == {"_code": "123456"}


def test_provider_factory_selects_development_provider() -> None:
    provider = get_sms_provider(
        Settings(database_url="postgresql+psycopg://user:pass@db/beiyu")
    )

    assert isinstance(provider, DevelopmentSmsProvider)
    assert provider.create_code() == "123456"


def test_provider_factory_rejects_unimplemented_cloud_provider() -> None:
    with pytest.raises(RuntimeError, match="not configured"):
        get_sms_provider(
            Settings(
                database_url="postgresql+psycopg://user:pass@db/beiyu",
                sms_provider=SmsProvider.ALIYUN,
            )
        )
