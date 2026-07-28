import pytest
from pydantic import ValidationError

from app.core.config import Environment, Settings


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
