from enum import StrEnum
from functools import lru_cache
from urllib.parse import urlparse

from pydantic import (
    Field,
    PostgresDsn,
    RedisDsn,
    SecretStr,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, SettingsConfigDict

MIN_SECRET_KEY_LENGTH = 32
DEVELOPMENT_AI_MODEL = "beiyu-development-v1"
DEVELOPMENT_MEMORY_HMAC_KEY = "beiyu-development-memory-hmac-key"


class Environment(StrEnum):
    DEV = "dev"
    STAGING = "staging"
    PROD = "prod"


class SmsProvider(StrEnum):
    DEVELOPMENT = "development"
    ALIYUN = "aliyun"


class AiProvider(StrEnum):
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
    otp_max_per_phone_day: int = Field(default=10, ge=1, le=50)
    otp_max_per_device_day: int = Field(default=20, ge=1, le=100)
    otp_max_per_ip_day: int = Field(default=30, ge=1, le=200)
    max_active_devices: int = Field(default=5, ge=1, le=10)
    ai_enabled: bool = True
    ai_provider: AiProvider = AiProvider.DEVELOPMENT
    ai_model: str = Field(default=DEVELOPMENT_AI_MODEL, min_length=1, max_length=200)
    ai_daily_limit: int = Field(default=50, ge=1, le=1000)
    ai_requests_per_minute: int = Field(default=10, ge=1, le=100)
    ai_timeout_seconds: int = Field(default=20, ge=1, le=120)
    ai_reservation_seconds: int = Field(default=120, ge=1, le=600)
    ai_context_messages: int = Field(default=20, ge=1, le=100)
    ai_memory_limit: int = Field(default=20, ge=1, le=100)
    ai_base_url: str | None = None
    ai_api_key: SecretStr | None = None
    ai_memory_hmac_key: SecretStr = SecretStr(DEVELOPMENT_MEMORY_HMAC_KEY)

    @field_validator("ai_model", mode="before")
    @classmethod
    def normalize_ai_model(cls, value: object) -> object:
        return value.strip() if isinstance(value, str) else value

    @field_validator("ai_base_url", mode="before")
    @classmethod
    def normalize_optional_ai_base_url(cls, value: object) -> object:
        if isinstance(value, str):
            value = value.strip()
            return value or None
        return value

    @field_validator("ai_api_key", mode="before")
    @classmethod
    def normalize_ai_api_key(cls, value: object) -> object:
        if isinstance(value, SecretStr):
            value = value.get_secret_value()
        return value.strip() if isinstance(value, str) else value

    @field_validator("ai_memory_hmac_key", mode="before")
    @classmethod
    def reject_blank_memory_hmac_key(cls, value: object) -> object:
        if isinstance(value, SecretStr):
            value = value.get_secret_value()
        if isinstance(value, str) and not value.strip():
            raise ValueError("memory HMAC key must not be blank")
        return value

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
        if (
            self.environment is not Environment.DEV
            and self.ai_provider is AiProvider.DEVELOPMENT
        ):
            raise ValueError("development AI provider is only allowed in dev")
        if self.ai_provider is AiProvider.ALIYUN:
            parsed_base_url = urlparse(self.ai_base_url or "")
            if parsed_base_url.scheme != "https" or not parsed_base_url.netloc:
                raise ValueError("aliyun AI provider requires an HTTPS base URL")
            if self.ai_api_key is None or not self.ai_api_key.get_secret_value():
                raise ValueError("aliyun AI provider requires an API key")
            if self.ai_model == DEVELOPMENT_AI_MODEL:
                raise ValueError("aliyun AI provider requires a configured model")
        if self.environment is not Environment.DEV:
            memory_hmac_key = self.ai_memory_hmac_key.get_secret_value()
            api_key = self.ai_api_key.get_secret_value() if self.ai_api_key else None
            if (
                memory_hmac_key == DEVELOPMENT_MEMORY_HMAC_KEY
                or len(memory_hmac_key.encode("utf-8")) < MIN_SECRET_KEY_LENGTH
                or not memory_hmac_key.strip()
                or memory_hmac_key == self.secret_key
                or memory_hmac_key == api_key
            ):
                raise ValueError("memory HMAC key must be independently configured")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
