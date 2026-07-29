import pytest
from pydantic import SecretStr, ValidationError

from app.core.config import AiProvider, Environment, Settings, get_settings
from app.main import create_app


def test_settings_default_to_dev() -> None:
    settings = Settings(database_url="postgresql+psycopg://user:pass@db/beiyu")

    assert settings.environment is Environment.DEV
    assert settings.api_v1_prefix == "/api/v1"
    assert settings.access_token_minutes == 15
    assert settings.refresh_token_days == 90
    assert settings.sms_provider == "development"
    assert settings.sms_development_code == "123456"
    assert settings.max_active_devices == 5
    assert settings.ai_enabled is True
    assert settings.ai_provider is AiProvider.DEVELOPMENT
    assert settings.ai_model == "beiyu-development-v1"
    assert settings.ai_daily_limit == 50
    assert settings.ai_requests_per_minute == 10
    assert settings.ai_timeout_seconds == 20
    assert settings.ai_reservation_seconds == 120
    assert settings.ai_context_messages == 20
    assert settings.ai_memory_limit == 20
    assert settings.ai_base_url is None
    assert settings.ai_api_key is None
    assert isinstance(settings.ai_memory_hmac_key, SecretStr)
    assert settings.ai_memory_hmac_key.get_secret_value()


def test_prod_rejects_placeholder_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="change-me",
        )


def test_prod_rejects_development_sms_provider() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="x" * 32,
            sms_provider="development",
        )


@pytest.mark.parametrize("environment", [Environment.STAGING, Environment.PROD])
def test_non_dev_rejects_development_ai_defaults(environment: Environment) -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment=environment,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="s" * 32,
            sms_provider="aliyun",
        )


def test_aliyun_requires_https_url_key_and_non_development_model() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="s" * 32,
            sms_provider="aliyun",
            ai_provider=AiProvider.ALIYUN,
            ai_model="beiyu-development-v1",
            ai_base_url="http://example.test/v1",
            ai_api_key=SecretStr("provider-key"),
            ai_memory_hmac_key=SecretStr("m" * 32),
        )


def test_non_dev_accepts_independent_aliyun_secrets() -> None:
    settings = Settings(
        environment=Environment.PROD,
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        secret_key="s" * 32,
        sms_provider="aliyun",
        ai_provider=AiProvider.ALIYUN,
        ai_model="qwen-plus",
        ai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        ai_api_key=SecretStr("provider-key"),
        ai_memory_hmac_key=SecretStr("m" * 32),
    )

    assert settings.ai_base_url == "https://dashscope.aliyuncs.com/compatible-mode/v1"
    assert isinstance(settings.ai_api_key, SecretStr)


@pytest.mark.parametrize(
    ("field_name", "value"),
    [
        ("ai_daily_limit", 0),
        ("ai_requests_per_minute", 0),
        ("ai_timeout_seconds", 0),
        ("ai_reservation_seconds", 0),
        ("ai_context_messages", 0),
        ("ai_memory_limit", 0),
    ],
)
def test_ai_numeric_limits_reject_zero(field_name: str, value: int) -> None:
    with pytest.raises(ValidationError):
        Settings.model_validate(
            {
                "database_url": "postgresql+psycopg://user:pass@db/beiyu",
                field_name: value,
            }
        )


def test_non_dev_memory_hmac_key_must_be_independent_and_secret() -> None:
    shared_secret = "x" * 32

    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key=shared_secret,
            sms_provider="aliyun",
            ai_provider=AiProvider.ALIYUN,
            ai_model="qwen-plus",
            ai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            ai_api_key=SecretStr("provider-key"),
            ai_memory_hmac_key=SecretStr(shared_secret),
        )

    assert shared_secret not in str(exc_info.value)


def test_settings_reject_env_api_v1_prefix_override(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BEIYU_API_V1_PREFIX", "/api/v2")

    with pytest.raises(ValidationError):
        Settings(
            database_url="postgresql+psycopg://user:pass@db/beiyu",
        )


@pytest.mark.parametrize("environment", [Environment.STAGING, Environment.PROD])
@pytest.mark.parametrize("secret_key", ["", "short"])
def test_non_dev_rejects_blank_or_short_secret(
    environment: Environment, secret_key: str
) -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment=environment,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key=secret_key,
        )


def test_app_creation_rejects_prod_placeholder_secret(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BEIYU_ENVIRONMENT", "prod")
    monkeypatch.setenv("BEIYU_DATABASE_URL", "postgresql+psycopg://user:pass@db/beiyu")
    monkeypatch.setenv("BEIYU_SECRET_KEY", "change-me")
    get_settings.cache_clear()

    try:
        with pytest.raises(ValidationError):
            create_app()
    finally:
        get_settings.cache_clear()
