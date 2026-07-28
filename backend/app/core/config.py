from enum import StrEnum
from functools import lru_cache

from pydantic import PostgresDsn, RedisDsn, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_SECRET_KEY_LENGTH = 32


class Environment(StrEnum):
    DEV = "dev"
    STAGING = "staging"
    PROD = "prod"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BEIYU_", env_file=None)

    environment: Environment = Environment.DEV
    api_v1_prefix: str = "/api/v1"
    database_url: PostgresDsn
    redis_url: RedisDsn | None = None
    secret_key: str = "change-me"

    @model_validator(mode="after")
    def require_generated_secret_outside_dev(self) -> "Settings":
        if self.api_v1_prefix != "/api/v1":
            raise ValueError("api_v1_prefix must be /api/v1")
        if self.environment is not Environment.DEV and (
            self.secret_key == "change-me"
            or len(self.secret_key.strip()) < MIN_SECRET_KEY_LENGTH
        ):
            raise ValueError("secret_key must be a generated value outside dev")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
