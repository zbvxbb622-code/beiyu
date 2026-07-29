from datetime import UTC, datetime

import pytest

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import User, UserStatus
from app.modules.ai.access import require_ai_access


def user(*, status: UserStatus = UserStatus.ACTIVE, age_confirmed: bool = True) -> User:
    return User(
        phone_hash="hash",
        phone_masked="+86138****0000",
        status=status,
        age_confirmed_at=datetime(2026, 7, 29, tzinfo=UTC) if age_confirmed else None,
    )


def assert_access_error(
    subject: User,
    code: str,
    status_code: int,
    *,
    ai_enabled: bool = True,
) -> None:
    with pytest.raises(AppError) as exc_info:
        require_ai_access(
            subject,
            Settings(
                database_url="postgresql+psycopg://user:pass@db/beiyu",
                ai_enabled=ai_enabled,
            ),
        )

    assert exc_info.value.code == code
    assert exc_info.value.status_code == status_code
    assert exc_info.value.details == {}
    assert subject.phone_masked not in str(exc_info.value.__dict__)


def test_banned_user_is_denied_before_age_or_feature_checks() -> None:
    assert_access_error(
        user(status=UserStatus.BANNED, age_confirmed=False),
        "AI_ACCESS_SUSPENDED",
        403,
        ai_enabled=False,
    )


def test_unconfirmed_user_is_denied_before_feature_check() -> None:
    assert_access_error(
        user(age_confirmed=False),
        "AGE_CONFIRMATION_REQUIRED",
        403,
        ai_enabled=False,
    )


def test_active_confirmed_user_is_denied_when_ai_is_disabled() -> None:
    assert_access_error(user(), "AI_FEATURE_DISABLED", 403, ai_enabled=False)


def test_active_confirmed_user_can_access_enabled_ai() -> None:
    require_ai_access(
        user(),
        Settings(database_url="postgresql+psycopg://user:pass@db/beiyu"),
    )
