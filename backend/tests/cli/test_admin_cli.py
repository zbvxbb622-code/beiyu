import pytest
from sqlmodel import Session

from app.cli import promote_admin, revoke_admin
from app.core.errors import AppError
from app.core.security import mask_phone, normalize_cn_phone, phone_hash
from app.db.models import User, UserRole

PHONE = "13800138000"
SECRET = "test-secret"


def create_user(session: Session) -> User:
    normalized = normalize_cn_phone(PHONE)
    user = User(
        phone_hash=phone_hash(normalized, SECRET),
        phone_masked=mask_phone(normalized),
    )
    session.add(user)
    session.commit()
    return user


def test_promote_and_revoke_existing_admin(database_session: Session) -> None:
    user = create_user(database_session)

    promoted = promote_admin(
        database_session,
        raw_phone=PHONE,
        role=UserRole.EDITOR,
        secret_key=SECRET,
    )
    assert promoted.id == user.id
    assert promoted.role is UserRole.EDITOR

    revoked = revoke_admin(
        database_session,
        raw_phone=PHONE,
        secret_key=SECRET,
    )
    assert revoked.role is UserRole.USER


def test_promote_unknown_phone_returns_controlled_error(
    database_session: Session,
) -> None:
    with pytest.raises(AppError) as exc_info:
        promote_admin(
            database_session,
            raw_phone=PHONE,
            role=UserRole.EDITOR,
            secret_key=SECRET,
        )

    assert exc_info.value.code == "ADMIN_USER_NOT_FOUND"
    assert exc_info.value.status_code == 404
