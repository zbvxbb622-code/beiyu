import pytest
from pydantic import SecretStr, ValidationError
from starlette.testclient import TestClient

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
    assert settings.cors_allowed_origins == ()


def test_cors_allowed_origins_parse_comma_separated_env_value() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        cors_allowed_origins="http://localhost:8081, https://demo.example.test ",
    )

    assert settings.cors_allowed_origins == (
        "http://localhost:8081",
        "https://demo.example.test",
    )


def test_non_dev_rejects_wildcard_cors_origins() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="s" * 32,
            sms_provider="aliyun",
            ai_provider=AiProvider.ALIYUN,
            ai_model="qwen-plus",
            ai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            ai_api_key=SecretStr("provider-key"),
            ai_memory_hmac_key=SecretStr("m" * 32),
            cors_allowed_origins="*",
        )


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
def test_aliyun_settings_reject_untrusted_or_ambiguous_base_urls(base_url: str) -> None:
    with pytest.raises(ValidationError) as exc_info:
        Settings(
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            ai_provider=AiProvider.ALIYUN,
            ai_model="qwen-plus",
            ai_base_url=base_url,
            ai_api_key=SecretStr("provider-key"),
        )

    assert "provider-key" not in str(exc_info.value)


def test_aliyun_settings_canonicalize_official_workspace_base_url() -> None:
    settings = Settings(
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        ai_provider=AiProvider.ALIYUN,
        ai_model="qwen-plus",
        ai_base_url="https://WORKSPACE-42.cn-beijing.maas.aliyuncs.com:443/compatible-mode/v1/",
        ai_api_key=SecretStr("provider-key"),
    )

    assert settings.ai_base_url == "https://workspace-42.cn-beijing.maas.aliyuncs.com/compatible-mode/v1"


def test_ai_model_and_api_key_strip_surrounding_whitespace() -> None:
    settings = Settings(
        environment=Environment.PROD,
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        secret_key="s" * 32,
        sms_provider="aliyun",
        ai_provider=AiProvider.ALIYUN,
        ai_model="  qwen-plus  ",
        ai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        ai_api_key=SecretStr("  provider-key  "),
        ai_memory_hmac_key=SecretStr("m" * 32),
    )

    assert settings.ai_model == "qwen-plus"
    assert settings.ai_api_key is not None
    assert settings.ai_api_key.get_secret_value() == "provider-key"


@pytest.mark.parametrize(
    ("field_name", "value"),
    [("ai_model", " \t "), ("ai_api_key", SecretStr(" \n "))],
)
def test_non_dev_rejects_blank_model_or_provider_key(
    field_name: str,
    value: str | SecretStr,
) -> None:
    provider_key = SecretStr("provider-key")
    values: dict[str, object] = {
        "environment": Environment.PROD,
        "database_url": "postgresql+psycopg://user:pass@db/beiyu",
        "secret_key": "s" * 32,
        "sms_provider": "aliyun",
        "ai_provider": AiProvider.ALIYUN,
        "ai_model": "qwen-plus",
        "ai_base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "ai_api_key": provider_key,
        "ai_memory_hmac_key": SecretStr("m" * 32),
    }
    values[field_name] = value

    with pytest.raises(ValidationError) as exc_info:
        Settings.model_validate(values)

    assert "provider-key" not in str(exc_info.value)


def test_non_dev_rejects_all_whitespace_memory_hmac_key() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="s" * 32,
            sms_provider="aliyun",
            ai_provider=AiProvider.ALIYUN,
            ai_model="qwen-plus",
            ai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            ai_api_key=SecretStr("provider-key"),
            ai_memory_hmac_key=SecretStr(" " * 32),
        )


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


@pytest.mark.parametrize(
    ("secret_key", "api_key"),
    [
        ("shared-secret-value-which-is-32-bytes ", "provider-key"),
        ("s" * 32, " shared-secret-value-which-is-32-bytes"),
    ],
)
def test_non_dev_rejects_memory_hmac_key_matching_trimmed_secret_values(
    secret_key: str,
    api_key: str,
) -> None:
    shared_hmac_key = "shared-secret-value-which-is-32-bytes"

    with pytest.raises(ValidationError) as exc_info:
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key=secret_key,
            sms_provider="aliyun",
            ai_provider=AiProvider.ALIYUN,
            ai_model="qwen-plus",
            ai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            ai_api_key=SecretStr(api_key),
            ai_memory_hmac_key=SecretStr(f"  {shared_hmac_key}  "),
        )

    assert shared_hmac_key not in str(exc_info.value)


def test_memory_hmac_key_uses_canonical_utf8_byte_length() -> None:
    exactly_32_bytes = "密" * 10 + "ab"
    settings = Settings(
        environment=Environment.PROD,
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        secret_key="s" * 32,
        sms_provider="aliyun",
        ai_provider=AiProvider.ALIYUN,
        ai_model="qwen-plus",
        ai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
        ai_api_key=SecretStr("provider-key"),
        ai_memory_hmac_key=SecretStr(f"  {exactly_32_bytes}  "),
    )

    assert settings.ai_memory_hmac_key.get_secret_value() == exactly_32_bytes
    with pytest.raises(ValidationError):
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="s" * 32,
            sms_provider="aliyun",
            ai_provider=AiProvider.ALIYUN,
            ai_model="qwen-plus",
            ai_base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
            ai_api_key=SecretStr("provider-key"),
            ai_memory_hmac_key=SecretStr("密" * 10 + "a"),
        )


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


def test_app_preflight_allows_configured_cors_origin(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("BEIYU_DATABASE_URL", "postgresql+psycopg://user:pass@db/beiyu")
    monkeypatch.setenv("BEIYU_CORS_ALLOWED_ORIGINS", "http://localhost:8081")
    get_settings.cache_clear()

    try:
        with TestClient(create_app()) as client:
            response = client.options(
                "/api/v1",
                headers={
                    "Origin": "http://localhost:8081",
                    "Access-Control-Request-Method": "GET",
                },
            )
    finally:
        get_settings.cache_clear()

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://localhost:8081"
