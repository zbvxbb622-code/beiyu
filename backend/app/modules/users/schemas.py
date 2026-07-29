import uuid
from datetime import date, datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.db.models import DevicePlatform
from app.modules.auth.schemas import AuthenticatedUser
from app.modules.cellar.schemas import CellarListResponse
from app.schemas.base import ApiModel


class UserProfileResponse(ApiModel):
    nickname: str
    avatar_key: str
    avatar_uri: str | None = None
    signature: str
    city: str
    gender: str | None
    birthday: date | None
    show_birthday_tag: bool
    show_age: bool
    show_zodiac: bool
    occupation: str | None
    school: str | None


class UserProfilePatch(ApiModel):
    nickname: str | None = Field(default=None, min_length=1, max_length=16)
    avatar_key: str | None = Field(default=None, min_length=1, max_length=80)
    signature: str | None = Field(default=None, max_length=60)
    city: str | None = Field(default=None, max_length=12)
    gender: str | None = Field(default=None, max_length=40)
    birthday: date | None = None
    show_birthday_tag: bool | None = None
    show_age: bool | None = None
    show_zodiac: bool | None = None
    occupation: str | None = Field(default=None, max_length=80)
    school: str | None = Field(default=None, max_length=120)

    @model_validator(mode="after")
    def required_display_fields_cannot_be_null(self) -> "UserProfilePatch":
        required_fields = {"nickname", "avatar_key", "signature", "city"}
        if any(
            field_name in self.model_fields_set and getattr(self, field_name) is None
            for field_name in required_fields
        ):
            raise ValueError("required profile fields cannot be null")
        return self

    @field_validator("birthday")
    @classmethod
    def birthday_cannot_be_in_the_future(cls, value: date | None) -> date | None:
        if value is not None and value > date.today():
            raise ValueError("birthday cannot be in the future")
        return value


class PrivacySettingsResponse(ApiModel):
    local_only_mode: bool
    analytics_opt_in: bool
    sync_when_logged_in: bool


class PrivacySettingsPatch(ApiModel):
    local_only_mode: bool | None = None
    analytics_opt_in: bool | None = None
    sync_when_logged_in: bool | None = None


class AgeConfirmationRequest(ApiModel):
    confirmed: Literal[True]


class AgeConfirmationResponse(ApiModel):
    age_confirmed: bool
    confirmed_at: datetime


class AccountDevice(ApiModel):
    id: uuid.UUID
    name: str
    platform: DevicePlatform
    last_active_at: datetime
    is_current: bool


class AccountSecurityResponse(ApiModel):
    phone: str
    phone_verified: bool
    wechat_bound: bool = False
    wechat_account: str = ""
    password_set: bool = False
    realname_verified: bool = False
    realname_name: str = ""
    official_verified: bool = False
    official_type: str = ""
    devices: list[AccountDevice]


class AiAllowance(ApiModel):
    daily_message_limit: int
    messages_used_today: int


class FeatureFlags(ApiModel):
    real_sms: bool = False
    media_upload: bool = False
    legal_name_verification: bool = False
    ai_chat: bool = False
    community: bool = False


class BootstrapResponse(ApiModel):
    user: AuthenticatedUser
    profile: UserProfileResponse
    privacy: PrivacySettingsResponse
    account_security: AccountSecurityResponse
    cellar: CellarListResponse
    ai: AiAllowance
    feature_flags: FeatureFlags


class DeleteAccountRequest(ApiModel):
    confirmation: Literal["DELETE"]


class LocalSyncRequest(ApiModel):
    age_verified: bool = False
    profile: UserProfilePatch | None = None
    privacy_settings: PrivacySettingsPatch | None = None
    cellar_ingredient_ids: list[str] = Field(default_factory=list, max_length=200)
