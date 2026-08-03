import uuid
from datetime import UTC, date, datetime, timedelta
from enum import StrEnum

from sqlalchemy import JSON, CheckConstraint, DateTime, Enum, UniqueConstraint
from sqlalchemy.dialects.postgresql import INET, JSONB
from sqlmodel import Column, Field, SQLModel


def utc_now() -> datetime:
    return datetime.now(UTC)


def otp_expiry() -> datetime:
    return utc_now() + timedelta(minutes=5)


def default_visibility() -> dict[str, bool]:
    return {
        "localOnlyMode": True,
        "analyticsOptIn": False,
        "syncWhenLoggedIn": False,
        "showBirthdayTag": True,
        "showAge": True,
        "showZodiac": False,
    }


class UserStatus(StrEnum):
    ACTIVE = "ACTIVE"
    BANNED = "BANNED"
    DELETED = "DELETED"


class MembershipLevel(StrEnum):
    FREE = "FREE"
    MEMBER = "MEMBER"


class UserRole(StrEnum):
    USER = "USER"
    EDITOR = "EDITOR"
    MODERATOR = "MODERATOR"
    SUPER_ADMIN = "SUPER_ADMIN"


class DevicePlatform(StrEnum):
    IOS = "IOS"
    ANDROID = "ANDROID"
    WEB = "WEB"


class SmsScene(StrEnum):
    LOGIN = "LOGIN"
    BIND_PHONE = "BIND_PHONE"


class User(SQLModel, table=True):
    __tablename__ = "users"
    __table_args__ = (UniqueConstraint("phone_hash", name="uq_users_phone_hash"),)

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    phone_hash: str = Field(max_length=64, index=True)
    phone_masked: str = Field(max_length=24)
    status: UserStatus = Field(
        default=UserStatus.ACTIVE,
        sa_column=Column(
            Enum(UserStatus, name="user_status"),
            nullable=False,
            index=True,
        ),
    )
    role: UserRole = Field(
        default=UserRole.USER,
        sa_column=Column(
            Enum(UserRole, name="user_role"),
            nullable=False,
            index=True,
        ),
    )
    age_confirmed_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    memory_enabled: bool = True
    membership_level: MembershipLevel = Field(
        default=MembershipLevel.FREE,
        sa_column=Column(
            Enum(MembershipLevel, name="membership_level"),
            nullable=False,
        ),
    )
    deleted_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    anonymized_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class UserProfile(SQLModel, table=True):
    __tablename__ = "user_profiles"

    user_id: uuid.UUID = Field(
        primary_key=True,
        foreign_key="users.id",
        ondelete="CASCADE",
    )
    nickname: str = Field(default="测试账号", max_length=40)
    avatar_media_id: uuid.UUID | None = None
    avatar_key: str = Field(default="avatarOne", max_length=80)
    signature: str = Field(default="", max_length=160)
    city: str = Field(default="", max_length=80)
    gender: str | None = Field(default=None, max_length=40)
    birthday: date | None = None
    occupation: str | None = Field(default=None, max_length=80)
    school: str | None = Field(default=None, max_length=120)
    visibility: dict[str, bool] = Field(
        default_factory=default_visibility,
        sa_column=Column(
            JSON().with_variant(JSONB, "postgresql"),
            nullable=False,
        ),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class UserDevice(SQLModel, table=True):
    __tablename__ = "user_devices"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "installation_id_hash",
            name="uq_user_devices_installation",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        index=True,
    )
    installation_id_hash: str = Field(max_length=64)
    platform: DevicePlatform = Field(
        sa_column=Column(
            Enum(DevicePlatform, name="device_platform"),
            nullable=False,
        ),
    )
    device_name: str = Field(max_length=120)
    app_version: str = Field(max_length=40)
    last_active_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    revoked_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class AuthSession(SQLModel, table=True):
    __tablename__ = "auth_sessions"
    __table_args__ = (
        UniqueConstraint(
            "refresh_token_hash",
            name="uq_auth_sessions_refresh_token_hash",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        index=True,
    )
    device_id: uuid.UUID = Field(
        foreign_key="user_devices.id",
        ondelete="CASCADE",
        index=True,
    )
    refresh_token_hash: str = Field(max_length=64, index=True)
    expires_at: datetime = Field(
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )
    revoked_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class SmsCode(SQLModel, table=True):
    __tablename__ = "sms_codes"
    __table_args__ = (
        CheckConstraint("failed_attempts >= 0", name="ck_sms_codes_failed_attempts"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    phone_hash: str = Field(max_length=64, index=True)
    scene: SmsScene = Field(
        sa_column=Column(
            Enum(SmsScene, name="sms_scene"),
            nullable=False,
            index=True,
        ),
    )
    code_hash: str = Field(max_length=64)
    device_hash: str = Field(max_length=64, index=True)
    ip_address: str = Field(sa_column=Column(INET, nullable=False, index=True))
    failed_attempts: int = Field(default=0, ge=0)
    expires_at: datetime = Field(
        default_factory=otp_expiry,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )
    consumed_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )
