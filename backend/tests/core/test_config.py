import pytest
from pydantic import ValidationError

from app.core.config import Environment, Settings, get_settings
from app.main import create_app


def test_settings_default_to_dev() -> None:
    settings = Settings(database_url="postgresql+psycopg://user:pass@db/beiyu")

    assert settings.environment is Environment.DEV
    assert settings.api_v1_prefix == "/api/v1"


def test_prod_rejects_placeholder_secret() -> None:
    with pytest.raises(ValidationError):
        Settings(
            environment=Environment.PROD,
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            secret_key="change-me",
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
