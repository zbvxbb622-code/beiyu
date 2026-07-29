from datetime import UTC, date, datetime
from uuid import uuid4

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.config import Settings
from app.db.models import AiDailyQuota, User
from app.modules.ai.quota import next_reset, quota_date, quota_snapshot


def persisted_user(session: Session) -> User:
    user = User(phone_hash=f"hash-{uuid4().hex}", phone_masked="+86138****0000")
    session.add(user)
    session.flush()
    return user


def test_beijing_quota_date_changes_at_1600_utc() -> None:
    assert quota_date(datetime(2026, 7, 29, 15, 59, 59, tzinfo=UTC)) == date(2026, 7, 29)
    assert quota_date(datetime(2026, 7, 29, 16, 0, tzinfo=UTC)) == date(2026, 7, 30)


def test_next_reset_is_the_next_beijing_midnight_in_utc() -> None:
    assert next_reset(datetime(2026, 7, 29, 15, 59, 59, tzinfo=UTC)) == datetime(
        2026, 7, 29, 16, tzinfo=UTC
    )
    assert next_reset(datetime(2026, 7, 29, 16, tzinfo=UTC)) == datetime(
        2026, 7, 30, 16, tzinfo=UTC
    )


def test_snapshot_without_today_row_is_read_only_and_returns_full_limit(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)

    snapshot = quota_snapshot(
        database_session,
        user.id,
        Settings(database_url="postgresql+psycopg://user:pass@db/beiyu"),
        now,
    )

    assert snapshot.daily_message_limit == 50
    assert snapshot.messages_used_today == 0
    assert snapshot.remaining == 50
    assert snapshot.resets_at == datetime(2026, 7, 29, 16, tzinfo=UTC)
    assert database_session.exec(select(func.count()).select_from(AiDailyQuota)).one() == 0


def test_snapshot_uses_configured_limit_and_only_todays_row(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    database_session.add(
        AiDailyQuota(
            user_id=user.id,
            quota_date=date(2026, 7, 29),
            free_limit=50,
            used_count=8,
            reserved_count=3,
        )
    )
    database_session.add(
        AiDailyQuota(
            user_id=user.id,
            quota_date=date(2026, 7, 28),
            free_limit=50,
            used_count=49,
            reserved_count=0,
        )
    )
    database_session.flush()

    snapshot = quota_snapshot(
        database_session,
        user.id,
        Settings(
            database_url="postgresql+psycopg://user:pass@db/beiyu",
            ai_daily_limit=10,
        ),
        datetime(2026, 7, 29, 12, tzinfo=UTC),
    )

    assert snapshot.daily_message_limit == 10
    assert snapshot.messages_used_today == 8
    assert snapshot.remaining == 0
    assert snapshot.resets_at == datetime(2026, 7, 29, 16, tzinfo=UTC)
