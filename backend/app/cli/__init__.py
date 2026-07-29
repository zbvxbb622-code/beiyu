from sqlmodel import Session, select

from app.core.errors import AppError
from app.core.security import normalize_cn_phone, phone_hash
from app.db.models import User, UserRole


def _find_user_by_phone(
    session: Session,
    *,
    raw_phone: str,
    secret_key: str,
) -> User:
    try:
        normalized_phone = normalize_cn_phone(raw_phone)
    except ValueError as exc:
        raise AppError(
            code="INVALID_PHONE",
            message=str(exc),
            status_code=422,
        ) from exc
    stored_phone_hash = phone_hash(normalized_phone, secret_key)
    user = session.exec(
        select(User).where(User.phone_hash == stored_phone_hash)
    ).first()
    if user is None:
        raise AppError(
            code="ADMIN_USER_NOT_FOUND",
            message="请先使用该手机号登录杯语",
            status_code=404,
        )
    return user


def promote_admin(
    session: Session,
    *,
    raw_phone: str,
    role: UserRole,
    secret_key: str,
) -> User:
    if role is UserRole.USER:
        raise AppError(
            code="INVALID_ADMIN_ROLE",
            message="请选择 EDITOR 或 SUPER_ADMIN",
            status_code=422,
        )
    user = _find_user_by_phone(
        session,
        raw_phone=raw_phone,
        secret_key=secret_key,
    )
    user.role = role
    session.add(user)
    session.commit()
    session.refresh(user)
    return user


def revoke_admin(
    session: Session,
    *,
    raw_phone: str,
    secret_key: str,
) -> User:
    user = _find_user_by_phone(
        session,
        raw_phone=raw_phone,
        secret_key=secret_key,
    )
    user.role = UserRole.USER
    session.add(user)
    session.commit()
    session.refresh(user)
    return user
