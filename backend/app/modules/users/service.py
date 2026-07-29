from typing import Any, cast

from sqlalchemy.orm import InstrumentedAttribute
from sqlmodel import Session, select

from app.core.errors import AppError
from app.db.models import (
    AuthSession,
    CellarItem,
    User,
    UserDevice,
    UserProfile,
    UserStatus,
)
from app.db.models.accounts import default_visibility, utc_now
from app.modules.auth.schemas import AuthenticatedUser
from app.modules.auth.service import list_user_devices
from app.modules.users.schemas import (
    AccountDevice,
    AccountSecurityResponse,
    AiAllowance,
    BootstrapResponse,
    FeatureFlags,
    PrivacySettingsPatch,
    PrivacySettingsResponse,
    UserProfilePatch,
    UserProfileResponse,
)


def _column(value: Any) -> InstrumentedAttribute[Any]:
    return cast("InstrumentedAttribute[Any]", value)


def get_user_profile(session: Session, user: User) -> UserProfile:
    profile = session.get(UserProfile, user.id)
    if profile is None:
        raise AppError(
            code="PROFILE_NOT_FOUND",
            message="用户资料不存在",
            status_code=404,
        )
    return profile


def profile_response(profile: UserProfile) -> UserProfileResponse:
    visibility = default_visibility() | profile.visibility
    return UserProfileResponse(
        nickname=profile.nickname,
        avatar_key=profile.avatar_key,
        avatar_uri=None,
        signature=profile.signature,
        city=profile.city,
        gender=profile.gender,
        birthday=profile.birthday,
        show_birthday_tag=visibility["showBirthdayTag"],
        show_age=visibility["showAge"],
        show_zodiac=visibility["showZodiac"],
        occupation=profile.occupation,
        school=profile.school,
    )


def privacy_response(profile: UserProfile) -> PrivacySettingsResponse:
    visibility = default_visibility() | profile.visibility
    return PrivacySettingsResponse(
        local_only_mode=visibility["localOnlyMode"],
        analytics_opt_in=visibility["analyticsOptIn"],
        sync_when_logged_in=visibility["syncWhenLoggedIn"],
    )


def update_profile(
    *,
    session: Session,
    user: User,
    patch: UserProfilePatch,
) -> UserProfile:
    profile = get_user_profile(session, user)
    values = patch.model_dump(exclude_unset=True, by_alias=False)
    visibility = default_visibility() | profile.visibility
    visibility_fields = {
        "show_birthday_tag": "showBirthdayTag",
        "show_age": "showAge",
        "show_zodiac": "showZodiac",
    }
    for field_name, value in values.items():
        if field_name in visibility_fields:
            if value is not None:
                visibility[visibility_fields[field_name]] = value
        else:
            setattr(profile, field_name, value)
    profile.visibility = visibility
    profile.updated_at = utc_now()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def update_privacy(
    *,
    session: Session,
    user: User,
    patch: PrivacySettingsPatch,
) -> UserProfile:
    profile = get_user_profile(session, user)
    visibility = default_visibility() | profile.visibility
    field_names = {
        "local_only_mode": "localOnlyMode",
        "analytics_opt_in": "analyticsOptIn",
        "sync_when_logged_in": "syncWhenLoggedIn",
    }
    for field_name, value in patch.model_dump(
        exclude_unset=True,
        by_alias=False,
    ).items():
        if value is not None:
            visibility[field_names[field_name]] = value
    profile.visibility = visibility
    profile.updated_at = utc_now()
    session.add(profile)
    session.commit()
    session.refresh(profile)
    return profile


def confirm_age(*, session: Session, user: User) -> User:
    if user.age_confirmed_at is None:
        user.age_confirmed_at = utc_now()
        user.updated_at = user.age_confirmed_at
        session.add(user)
        session.commit()
        session.refresh(user)
    return user


def bootstrap_response(
    *,
    session: Session,
    user: User,
    current_device: UserDevice,
) -> BootstrapResponse:
    profile = get_user_profile(session, user)
    devices = list_user_devices(session=session, user=user)
    return BootstrapResponse(
        user=AuthenticatedUser(
            id=user.id,
            phone_masked=user.phone_masked,
            status=user.status,
            age_confirmed=user.age_confirmed_at is not None,
            memory_enabled=user.memory_enabled,
            membership_level=user.membership_level,
        ),
        profile=profile_response(profile),
        privacy=privacy_response(profile),
        account_security=AccountSecurityResponse(
            phone=user.phone_masked,
            phone_verified=True,
            devices=[
                AccountDevice(
                    id=device.id,
                    name=device.device_name,
                    platform=device.platform,
                    last_active_at=device.last_active_at,
                    is_current=device.id == current_device.id,
                )
                for device in devices
            ],
        ),
        ai=AiAllowance(daily_message_limit=50, messages_used_today=0),
        feature_flags=FeatureFlags(),
    )


def delete_account(*, session: Session, user: User) -> None:
    now = utc_now()
    profile = get_user_profile(session, user)
    user.status = UserStatus.DELETED
    user.phone_masked = "已注销"
    user.memory_enabled = False
    user.deleted_at = now
    user.anonymized_at = now
    user.updated_at = now
    session.add(user)

    profile.nickname = "已注销用户"
    profile.avatar_media_id = None
    profile.avatar_key = "avatarOne"
    profile.signature = ""
    profile.city = ""
    profile.gender = None
    profile.birthday = None
    profile.occupation = None
    profile.school = None
    profile.visibility = default_visibility()
    profile.updated_at = now
    session.add(profile)

    devices = session.exec(
        select(UserDevice).where(UserDevice.user_id == user.id)
    ).all()
    for device in devices:
        device.revoked_at = device.revoked_at or now
        device.updated_at = now
        session.add(device)

    auth_sessions = session.exec(
        select(AuthSession).where(AuthSession.user_id == user.id)
    ).all()
    for auth_session in auth_sessions:
        auth_session.revoked_at = auth_session.revoked_at or now
        auth_session.updated_at = now
        session.add(auth_session)

    cellar_items = session.exec(
        select(CellarItem).where(
            CellarItem.user_id == user.id,
            _column(CellarItem.deleted_at).is_(None),
        )
    ).all()
    for item in cellar_items:
        item.deleted_at = now
        item.updated_at = now
        session.add(item)

    session.commit()
