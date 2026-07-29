import uuid
from datetime import datetime

from pydantic import Field

from app.db.models import (
    DevicePlatform,
    MembershipLevel,
    SmsScene,
    UserStatus,
)
from app.schemas.base import ApiModel


class SmsCodeRequest(ApiModel):
    phone: str = Field(min_length=5, max_length=32)
    scene: SmsScene = SmsScene.LOGIN
    installation_id: str = Field(min_length=8, max_length=200)


class SmsCodeAccepted(ApiModel):
    expires_in: int
    retry_after: int


class DeviceInput(ApiModel):
    installation_id: str = Field(min_length=8, max_length=200)
    platform: DevicePlatform
    device_name: str = Field(min_length=1, max_length=120)
    app_version: str = Field(min_length=1, max_length=40)


class LoginRequest(ApiModel):
    phone: str = Field(min_length=5, max_length=32)
    code: str = Field(pattern=r"^\d{6}$")
    device: DeviceInput


class AuthenticatedUser(ApiModel):
    id: uuid.UUID
    phone_masked: str
    status: UserStatus
    age_confirmed: bool
    memory_enabled: bool
    membership_level: MembershipLevel


class AuthenticatedDevice(ApiModel):
    id: uuid.UUID
    platform: DevicePlatform
    device_name: str
    app_version: str
    last_active_at: datetime
    is_current: bool


class LoginResponse(ApiModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int
    is_new_user: bool
    user: AuthenticatedUser
    device: AuthenticatedDevice


class RefreshRequest(ApiModel):
    refresh_token: str = Field(min_length=32, max_length=512)


class TokenResponse(ApiModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    expires_in: int
    refresh_expires_in: int


class DeviceList(ApiModel):
    items: list[AuthenticatedDevice]
