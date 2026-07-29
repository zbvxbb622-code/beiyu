from enum import StrEnum
from functools import lru_cache

from pydantic import Field, PostgresDsn, RedisDsn, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_SECRET_KEY_LENGTH = 32


class Environment(StrEnum):
    DEV = "dev"
    STAGING = "staging"
    PROD = "prod"


class SmsProvider(StrEnum):
    DEVELOPMENT = "development"
    ALIYUN = "aliyun"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="BEIYU_", env_file=None)

    environment: Environment = Environment.DEV
    api_v1_prefix: str = "/api/v1"
    database_url: PostgresDsn
    redis_url: RedisDsn | None = None
    secret_key: str = "change-me"
    access_token_minutes: int = Field(default=15, ge=5, le=60)
    refresh_token_days: int = Field(default=90, ge=1, le=365)
    sms_provider: SmsProvider = SmsProvider.DEVELOPMENT
    sms_development_code: str = Field(
        default="123456",
        min_length=6,
        max_length=6,
        pattern=r"^\d{6}$",
    )
    otp_expires_seconds: int = Field(default=300, ge=60, le=900)
    otp_retry_after_seconds: int = Field(default=60, ge=30, le=300)
    otp_max_attempts: int = Field(default=5, ge=1, le=10)
    max_active_devices: int = Field(default=5, ge=1, le=10)

    @model_validator(mode="after")
    def require_generated_secret_outside_dev(self) -> "Settings":
        if self.api_v1_prefix != "/api/v1":
            raise ValueError("api_v1_prefix must be /api/v1")
        if self.environment is not Environment.DEV and (
            self.secret_key == "change-me"
            or len(self.secret_key.strip()) < MIN_SECRET_KEY_LENGTH
        ):
            raise ValueError("secret_key must be a generated value outside dev")
        if (
            self.environment is not Environment.DEV
            and self.sms_provider is SmsProvider.DEVELOPMENT
        ):
            raise ValueError("development SMS provider is only allowed in dev")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
