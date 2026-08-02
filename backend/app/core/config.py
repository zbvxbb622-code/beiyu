import re
from enum import StrEnum
from functools import lru_cache
from typing import Annotated
from urllib.parse import urlparse

from pydantic import (
    Field,
    PostgresDsn,
    RedisDsn,
    SecretStr,
    field_validator,
    model_validator,
)
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

MIN_SECRET_KEY_LENGTH = 32
DEVELOPMENT_AI_MODEL = "beiyu-development-v1"
DEVELOPMENT_MEMORY_HMAC_KEY = "beiyu-development-memory-hmac-key"
DASHSCOPE_CHINA_HOST = "dashscope.aliyuncs.com"
DASHSCOPE_BEIJING_WORKSPACE_SUFFIX = ".cn-beijing.maas.aliyuncs.com"
DASHSCOPE_COMPATIBLE_MODE_PATH = "/compatible-mode/v1"
WORKSPACE_LABEL_PATTERN = re.compile(r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?")


def canonical_aliyun_base_url(base_url: str) -> str:
    """Accept only documented DashScope China compatible-mode origins."""
    parsed = urlparse(base_url)
    if parsed.scheme != "https" or not parsed.netloc:
        raise ValueError("Aliyun AI base URL must use HTTPS")
    if parsed.username is not None or parsed.password is not None:
        raise ValueError("Aliyun AI base URL must not include credentials")
    if parsed.query or parsed.fragment or parsed.params:
        raise ValueError("Aliyun AI base URL must not include a query, fragment, or parameters")
    try:
        port = parsed.port
    except ValueError as exc:
        raise ValueError("Aliyun AI base URL port is invalid") from exc
    if port not in (None, 443):
        raise ValueError("Aliyun AI base URL must use the default HTTPS port")
    hostname = parsed.hostname
    if hostname is None:
        raise ValueError("Aliyun AI base URL host is invalid")
    try:
        canonical_host = hostname.encode("idna").decode("ascii").lower()
    except UnicodeError as exc:
        raise ValueError("Aliyun AI base URL host is invalid") from exc
    path = parsed.path
    if "%2f" in path.lower() or "%2e" in path.lower():
        raise ValueError("Aliyun AI base URL path must not be percent encoded")
    if path.rstrip("/") != DASHSCOPE_COMPATIBLE_MODE_PATH:
        raise ValueError("Aliyun AI base URL must use the compatible-mode v1 path")
    if canonical_host != DASHSCOPE_CHINA_HOST:
        workspace = canonical_host.removesuffix(DASHSCOPE_BEIJING_WORKSPACE_SUFFIX)
        if (
            workspace == canonical_host
            or not WORKSPACE_LABEL_PATTERN.fullmatch(workspace)
        ):
            raise ValueError("Aliyun AI base URL host is not an approved DashScope origin")
    return f"https://{canonical_host}{DASHSCOPE_COMPATIBLE_MODE_PATH}"


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


class MediaProvider(StrEnum):
    LOCAL = "local"
    OSS = "oss"


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
    trusted_proxy_hosts: Annotated[tuple[str, ...], NoDecode] = ()
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
    media_provider: MediaProvider = MediaProvider.LOCAL
    media_upload_max_bytes: int = Field(default=5_242_880, ge=1, le=20_971_520)
    media_public_base_url: str | None = None
    media_oss_bucket: str | None = None
    media_oss_endpoint: str | None = None
    media_oss_access_key_id: SecretStr | None = None
    media_oss_access_key_secret: SecretStr | None = None
    cors_allowed_origins: Annotated[tuple[str, ...], NoDecode] = ()

    @field_validator("cors_allowed_origins", mode="before")
    @classmethod
    def parse_cors_allowed_origins(cls, value: object) -> object:
        if value is None:
            return ()
        if isinstance(value, str):
            return tuple(origin.strip() for origin in value.split(",") if origin.strip())
        if isinstance(value, (list, tuple, set)):
            return tuple(value)
        return value

    @field_validator("trusted_proxy_hosts", mode="before")
    @classmethod
    def parse_trusted_proxy_hosts(cls, value: object) -> object:
        if value is None:
            return ()
        if isinstance(value, str):
            return tuple(host.strip() for host in value.split(",") if host.strip())
        if isinstance(value, (list, tuple, set)):
            return tuple(value)
        return value

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

    @field_validator(
        "media_public_base_url",
        "media_oss_bucket",
        "media_oss_endpoint",
        mode="before",
    )
    @classmethod
    def normalize_optional_media_text(cls, value: object) -> object:
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

    @field_validator("media_oss_access_key_id", "media_oss_access_key_secret", mode="before")
    @classmethod
    def normalize_media_secret(cls, value: object) -> object:
        if isinstance(value, SecretStr):
            value = value.get_secret_value()
        return value.strip() if isinstance(value, str) else value

    @field_validator("ai_memory_hmac_key", mode="before")
    @classmethod
    def reject_blank_memory_hmac_key(cls, value: object) -> object:
        if isinstance(value, SecretStr):
            value = value.get_secret_value()
        if isinstance(value, str):
            value = value.strip()
            if not value:
                raise ValueError("memory HMAC key must not be blank")
        return value

    @model_validator(mode="after")
    def require_generated_secret_outside_dev(self) -> "Settings":
        if self.api_v1_prefix != "/api/v1":
            raise ValueError("api_v1_prefix must be /api/v1")
        if self.environment is not Environment.DEV and "*" in self.cors_allowed_origins:
            raise ValueError("wildcard CORS origins are only allowed in dev")
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
            if self.ai_base_url is None:
                raise ValueError("aliyun AI provider requires an HTTPS base URL")
            self.ai_base_url = canonical_aliyun_base_url(self.ai_base_url)
            if self.ai_api_key is None or not self.ai_api_key.get_secret_value():
                raise ValueError("aliyun AI provider requires an API key")
            if self.ai_model == DEVELOPMENT_AI_MODEL:
                raise ValueError("aliyun AI provider requires a configured model")
        if self.environment is not Environment.DEV and self.media_provider is MediaProvider.LOCAL:
            raise ValueError("local media provider is only allowed in dev")
        if self.media_provider is MediaProvider.OSS:
            media_values = (
                self.media_public_base_url,
                self.media_oss_bucket,
                self.media_oss_endpoint,
                self.media_oss_access_key_id.get_secret_value().strip()
                if self.media_oss_access_key_id
                else None,
                self.media_oss_access_key_secret.get_secret_value().strip()
                if self.media_oss_access_key_secret
                else None,
            )
            if any(not value for value in media_values):
                raise ValueError(
                    "OSS media provider requires bucket, endpoint, public base URL, and credentials"
                )
        if self.environment is not Environment.DEV:
            memory_hmac_key = self.ai_memory_hmac_key.get_secret_value()
            secret_key = self.secret_key.strip()
            api_key = (
                self.ai_api_key.get_secret_value().strip()
                if self.ai_api_key
                else None
            )
            if (
                memory_hmac_key == DEVELOPMENT_MEMORY_HMAC_KEY
                or len(memory_hmac_key.encode("utf-8")) < MIN_SECRET_KEY_LENGTH
                or memory_hmac_key == secret_key
                or memory_hmac_key == api_key
            ):
                raise ValueError("memory HMAC key must be independently configured")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
