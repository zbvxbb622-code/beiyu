from contextlib import nullcontext
from datetime import UTC, date, datetime
from types import SimpleNamespace
from typing import cast
from uuid import uuid4

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.config import Settings
from app.db.models import AiDailyQuota, User
from app.db.session import get_engine
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


def test_snapshot_does_not_flush_the_callers_pending_or_dirty_work(
    database_session: Session,
) -> None:
    dirty_user = persisted_user(database_session)
    pending_user = User(
        phone_hash=f"pending-{uuid4().hex}",
        phone_masked="+86138****9999",
    )
    database_session.add(pending_user)
    dirty_user.phone_masked = "+86138****1111"

    snapshot = quota_snapshot(
        database_session,
        dirty_user.id,
        Settings(database_url="postgresql+psycopg://user:pass@db/beiyu"),
        datetime(2026, 7, 29, 12, tzinfo=UTC),
    )

    assert snapshot.remaining == 50
    assert pending_user in database_session.new
    assert dirty_user in database_session.dirty
    with Session(get_engine()) as other_session:
        assert other_session.exec(
            select(User).where(User.phone_hash == pending_user.phone_hash)
        ).first() is None


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
    assert snapshot.messages_used_today == 10
    assert snapshot.remaining == 0
    assert snapshot.resets_at == datetime(2026, 7, 29, 16, tzinfo=UTC)


class SnapshotResult:
    def __init__(self, quota: object) -> None:
        self.quota = quota

    def first(self) -> object:
        return self.quota


class SnapshotSession:
    def __init__(self, quota: object) -> None:
        self.quota = quota

    def exec(self, _: object) -> SnapshotResult:
        return SnapshotResult(self.quota)

    @property
    def no_autoflush(self):
        return nullcontext()


def test_snapshot_clamps_negative_persisted_counts_before_calculating_allowance() -> None:
    snapshot = quota_snapshot(
        cast(Session, SnapshotSession(SimpleNamespace(used_count=-8, reserved_count=-3))),
        uuid4(),
        Settings(database_url="postgresql+psycopg://user:pass@db/beiyu"),
        datetime(2026, 7, 29, 12, tzinfo=UTC),
    )

    assert snapshot.messages_used_today == 0
    assert snapshot.remaining == 50


def test_snapshot_reports_all_available_allowance_as_used_when_completed_count_exceeds_limit() -> None:
    snapshot = quota_snapshot(
        cast(Session, SnapshotSession(SimpleNamespace(used_count=51, reserved_count=0))),
        uuid4(),
        Settings(database_url="postgresql+psycopg://user:pass@db/beiyu"),
        datetime(2026, 7, 29, 12, tzinfo=UTC),
    )

    assert snapshot.messages_used_today == 50
    assert snapshot.remaining == 0


def test_snapshot_reports_reserved_count_as_used_when_it_exceeds_limit() -> None:
    snapshot = quota_snapshot(
        cast(Session, SnapshotSession(SimpleNamespace(used_count=3, reserved_count=51))),
        uuid4(),
        Settings(database_url="postgresql+psycopg://user:pass@db/beiyu"),
        datetime(2026, 7, 29, 12, tzinfo=UTC),
    )

    assert snapshot.messages_used_today == 50
    assert snapshot.remaining == 0


def test_snapshot_counts_only_nonnegative_completed_and_reserved_values() -> None:
    snapshot = quota_snapshot(
        cast(Session, SnapshotSession(SimpleNamespace(used_count=-8, reserved_count=7))),
        uuid4(),
        Settings(database_url="postgresql+psycopg://user:pass@db/beiyu"),
        datetime(2026, 7, 29, 12, tzinfo=UTC),
    )

    assert snapshot.messages_used_today == 7
    assert snapshot.remaining == 43
