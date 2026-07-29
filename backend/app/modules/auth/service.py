import hmac
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import cast

from sqlalchemy import func, or_
from sqlalchemy.orm import InstrumentedAttribute
from sqlmodel import Session, select

from app.core.config import Settings
from app.core.errors import AppError
from app.core.security import (
    create_access_token,
    create_refresh_token,
    device_hash,
    mask_phone,
    normalize_cn_phone,
    otp_hash,
    phone_hash,
)
from app.db.models import (
    AuthSession,
    SmsCode,
    SmsScene,
    User,
    UserDevice,
    UserProfile,
    UserStatus,
)
from app.db.models.accounts import utc_now
from app.integrations.sms.base import SmsProvider
from app.modules.auth.schemas import DeviceInput


def _column[FieldType](value: FieldType) -> InstrumentedAttribute[FieldType]:
    return cast("InstrumentedAttribute[FieldType]", value)


@dataclass(frozen=True, slots=True)
class LoginResult:
    user: User
    device: UserDevice
    access_token: str
    refresh_token: str
    is_new_user: bool


def _normalized_phone(raw_phone: str) -> str:
    try:
        return normalize_cn_phone(raw_phone)
    except ValueError as exc:
        raise AppError(
            code="INVALID_PHONE",
            message=str(exc),
            status_code=422,
        ) from exc


def _raise_sms_rate_limit(retry_after: int) -> None:
    raise AppError(
        code="SMS_CODE_TOO_FREQUENT",
        message="验证码发送过于频繁，请稍后再试",
        status_code=429,
        details={"retryAfter": retry_after},
    )


def issue_sms_code(
    *,
    session: Session,
    provider: SmsProvider,
    settings: Settings,
    raw_phone: str,
    scene: SmsScene,
    installation_id: str,
    ip_address: str,
) -> None:
    if scene is not SmsScene.LOGIN:
        raise AppError(
            code="SMS_SCENE_UNAVAILABLE",
            message="当前验证码用途暂不可用",
            status_code=400,
        )

    normalized_phone = _normalized_phone(raw_phone)
    stored_phone_hash = phone_hash(normalized_phone, settings.secret_key)
    stored_device_hash = device_hash(installation_id, settings.secret_key)
    now = utc_now()
    retry_cutoff = now - timedelta(seconds=settings.otp_retry_after_seconds)

    recent = session.exec(
        select(SmsCode)
        .where(
            SmsCode.scene == scene,
            SmsCode.created_at > retry_cutoff,
            or_(
                _column(SmsCode.phone_hash) == stored_phone_hash,
                _column(SmsCode.device_hash) == stored_device_hash,
                _column(SmsCode.ip_address) == ip_address,
            ),
        )
        .order_by(_column(SmsCode.created_at).desc())
    ).first()
    if recent is not None:
        elapsed = max(0, int((now - recent.created_at).total_seconds()))
        _raise_sms_rate_limit(max(1, settings.otp_retry_after_seconds - elapsed))

    day_cutoff = now - timedelta(days=1)
    limits = (
        (SmsCode.phone_hash == stored_phone_hash, settings.otp_max_per_phone_day),
        (SmsCode.device_hash == stored_device_hash, settings.otp_max_per_device_day),
        (SmsCode.ip_address == ip_address, settings.otp_max_per_ip_day),
    )
    for condition, maximum in limits:
        count = session.exec(
            select(func.count())
            .select_from(SmsCode)
            .where(SmsCode.created_at > day_cutoff, condition)
        ).one()
        if count >= maximum:
            _raise_sms_rate_limit(settings.otp_retry_after_seconds)

    code = provider.create_code()
    sms_code = SmsCode(
        phone_hash=stored_phone_hash,
        scene=scene,
        code_hash=otp_hash(
            stored_phone_hash,
            scene.value,
            code,
            settings.secret_key,
        ),
        device_hash=stored_device_hash,
        ip_address=ip_address,
        expires_at=now + timedelta(seconds=settings.otp_expires_seconds),
    )
    session.add(sms_code)
    try:
        provider.send_code(
            phone=normalized_phone,
            code=code,
            expires_minutes=max(1, settings.otp_expires_seconds // 60),
        )
        session.commit()
    except Exception:
        session.rollback()
        raise


def _find_valid_sms_code(
    *,
    session: Session,
    stored_phone_hash: str,
    settings: Settings,
    code: str,
) -> SmsCode:
    now = utc_now()
    sms_code = session.exec(
        select(SmsCode)
        .where(
            SmsCode.phone_hash == stored_phone_hash,
            SmsCode.scene == SmsScene.LOGIN,
            _column(SmsCode.consumed_at).is_(None),
            SmsCode.expires_at > now,
        )
        .order_by(_column(SmsCode.created_at).desc())
        .with_for_update()
    ).first()
    if sms_code is None:
        raise AppError(
            code="INVALID_SMS_CODE",
            message="验证码无效或已过期",
            status_code=400,
        )

    expected_hash = otp_hash(
        stored_phone_hash,
        SmsScene.LOGIN.value,
        code,
        settings.secret_key,
    )
    if not hmac.compare_digest(sms_code.code_hash, expected_hash):
        sms_code.failed_attempts += 1
        if sms_code.failed_attempts >= settings.otp_max_attempts:
            sms_code.consumed_at = now
        session.add(sms_code)
        session.commit()
        raise AppError(
            code="INVALID_SMS_CODE",
            message="验证码无效或已过期",
            status_code=400,
        )

    sms_code.consumed_at = now
    session.add(sms_code)
    return sms_code


def _get_or_create_user(
    *,
    session: Session,
    stored_phone_hash: str,
    phone_masked: str,
) -> tuple[User, bool]:
    user = session.exec(
        select(User).where(User.phone_hash == stored_phone_hash).with_for_update()
    ).first()
    if user is not None:
        if user.status is UserStatus.BANNED:
            raise AppError(
                code="ACCOUNT_BANNED",
                message="账号当前不可用",
                status_code=403,
            )
        if user.status is UserStatus.DELETED:
            raise AppError(
                code="ACCOUNT_DELETED",
                message="账号已注销",
                status_code=403,
            )
        return user, False

    user = User(phone_hash=stored_phone_hash, phone_masked=phone_masked)
    session.add(user)
    session.flush()
    session.add(UserProfile(user_id=user.id))
    return user, True


def _upsert_device(
    *,
    session: Session,
    user: User,
    device_input: DeviceInput,
    settings: Settings,
) -> UserDevice:
    now = utc_now()
    stored_device_hash = device_hash(
        device_input.installation_id,
        settings.secret_key,
    )
    device = session.exec(
        select(UserDevice).where(
            UserDevice.user_id == user.id,
            UserDevice.installation_id_hash == stored_device_hash,
        )
    ).first()
    if device is None:
        device = UserDevice(
            user_id=user.id,
            installation_id_hash=stored_device_hash,
            platform=device_input.platform,
            device_name=device_input.device_name,
            app_version=device_input.app_version,
        )
    else:
        device.platform = device_input.platform
        device.device_name = device_input.device_name
        device.app_version = device_input.app_version
        device.revoked_at = None
        device.last_active_at = now
        device.updated_at = now
    session.add(device)
    session.flush()

    active_devices = session.exec(
        select(UserDevice)
        .where(
            UserDevice.user_id == user.id,
            _column(UserDevice.revoked_at).is_(None),
            UserDevice.id != device.id,
        )
        .order_by(_column(UserDevice.last_active_at).asc())
    ).all()
    overflow = max(0, len(active_devices) - settings.max_active_devices + 1)
    for old_device in active_devices[:overflow]:
        old_device.revoked_at = now
        old_device.updated_at = now
        session.add(old_device)
        old_sessions = session.exec(
            select(AuthSession).where(
                AuthSession.device_id == old_device.id,
                _column(AuthSession.revoked_at).is_(None),
            )
        ).all()
        for old_session in old_sessions:
            old_session.revoked_at = now
            old_session.updated_at = now
            session.add(old_session)
    return device


def login_with_sms(
    *,
    session: Session,
    settings: Settings,
    raw_phone: str,
    code: str,
    device_input: DeviceInput,
) -> LoginResult:
    normalized_phone = _normalized_phone(raw_phone)
    stored_phone_hash = phone_hash(normalized_phone, settings.secret_key)
    _find_valid_sms_code(
        session=session,
        stored_phone_hash=stored_phone_hash,
        settings=settings,
        code=code,
    )
    user, is_new_user = _get_or_create_user(
        session=session,
        stored_phone_hash=stored_phone_hash,
        phone_masked=mask_phone(normalized_phone),
    )
    device = _upsert_device(
        session=session,
        user=user,
        device_input=device_input,
        settings=settings,
    )
    refresh_token, stored_refresh_token_hash = create_refresh_token(settings.secret_key)
    auth_session = AuthSession(
        user_id=user.id,
        device_id=device.id,
        refresh_token_hash=stored_refresh_token_hash,
        expires_at=datetime.now(UTC) + timedelta(days=settings.refresh_token_days),
    )
    session.add(auth_session)
    session.flush()
    access_token = create_access_token(
        user.id,
        auth_session.id,
        settings.secret_key,
        expires_minutes=settings.access_token_minutes,
    )
    session.commit()
    session.refresh(user)
    session.refresh(device)
    return LoginResult(
        user=user,
        device=device,
        access_token=access_token,
        refresh_token=refresh_token,
        is_new_user=is_new_user,
    )
