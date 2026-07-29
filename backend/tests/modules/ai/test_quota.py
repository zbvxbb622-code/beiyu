from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from contextlib import nullcontext
from datetime import UTC, date, datetime, timedelta
from threading import Barrier
from types import SimpleNamespace
from typing import cast
from uuid import UUID, uuid4

import pytest
from sqlalchemy import func, text
from sqlmodel import Session, select

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import (
    AiChatMode,
    AiConversation,
    AiDailyQuota,
    AiMessage,
    AiMessageRole,
    AiRequest,
    AiRequestStatus,
    AiUsageLog,
    User,
)
from app.db.session import get_engine
from app.modules.ai import quota
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


def ai_settings(ai_requests_per_minute: int = 10) -> Settings:
    return Settings(
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        ai_requests_per_minute=ai_requests_per_minute,
    )


def usage(
    *,
    outcome: str = "SUCCEEDED",
    response_message_id: UUID | None = None,
) -> quota.UsageDetails:
    return quota.UsageDetails(
        outcome=outcome,
        provider="development",
        model="beiyu-development-v1",
        prompt_version="v1",
        latency_ms=12,
        response_message_id=response_message_id,
    )


def assert_error(code: str, action: Callable[[], object]) -> None:
    with pytest.raises(AppError) as raised:
        action()
    assert raised.value.code == code


def test_reservation_api_is_available() -> None:
    """Removing the reservation entrypoint would leave requests unprotected."""
    assert hasattr(quota, "reserve_request")


def test_reserve_and_complete_move_one_slot_and_write_one_usage_log(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)

    reserved = quota.reserve_request(
        database_session,
        user,
        uuid4(),
        AiChatMode.TEMPORARY,
        None,
        ai_settings(),
        now,
    )

    assert reserved.disposition is quota.ReservationDisposition.NEW
    assert reserved.request.status is AiRequestStatus.RESERVED
    current_quota = database_session.exec(
        select(AiDailyQuota).where(AiDailyQuota.user_id == user.id)
    ).one()
    assert (current_quota.used_count, current_quota.reserved_count) == (0, 1)

    snapshot = quota.complete_reservation(database_session, reserved.request, usage(), now)

    database_session.refresh(reserved.request)
    database_session.refresh(current_quota)
    assert reserved.request.status is AiRequestStatus.SUCCEEDED
    assert (current_quota.used_count, current_quota.reserved_count) == (1, 0)
    assert (snapshot.messages_used_today, snapshot.remaining) == (1, 49)
    logs = database_session.exec(
        select(AiUsageLog).where(AiUsageLog.request_id == reserved.request.id)
    ).all()
    assert [(log.attempt_no, log.outcome, log.input_tokens, log.output_tokens) for log in logs] == [
        (1, "SUCCEEDED", None, None)
    ]


def test_fiftieth_completion_is_accepted_and_fifty_first_reservation_is_rejected(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    settings = ai_settings(ai_requests_per_minute=100)
    database_session.add(
        AiDailyQuota(
            user_id=user.id,
            quota_date=quota_date(now),
            free_limit=50,
            used_count=49,
            reserved_count=0,
        )
    )
    database_session.flush()

    reserved = quota.reserve_request(
        database_session, user, uuid4(), AiChatMode.TEMPORARY, None, settings, now
    )
    quota.complete_reservation(database_session, reserved.request, usage(), now)

    assert_error(
        "AI_DAILY_QUOTA_EXHAUSTED",
        lambda: quota.reserve_request(
            database_session, user, uuid4(), AiChatMode.TEMPORARY, None, settings, now
        ),
    )
    current_quota = database_session.exec(
        select(AiDailyQuota).where(AiDailyQuota.user_id == user.id)
    ).one()
    assert (current_quota.used_count, current_quota.reserved_count) == (50, 0)


def test_provider_failure_releases_quota_and_same_id_retries_as_next_attempt(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    client_message_id = uuid4()
    first = quota.reserve_request(
        database_session,
        user,
        client_message_id,
        AiChatMode.TEMPORARY,
        None,
        ai_settings(),
        now,
    )

    quota.fail_reservation(
        database_session,
        first.request,
        "PROVIDER_UNAVAILABLE",
        usage(outcome="FAILED"),
        now,
    )
    retry = quota.reserve_request(
        database_session,
        user,
        client_message_id,
        AiChatMode.TEMPORARY,
        None,
        ai_settings(),
        now + timedelta(seconds=1),
    )

    database_session.refresh(retry.request)
    current_quota = database_session.exec(
        select(AiDailyQuota).where(AiDailyQuota.user_id == user.id)
    ).one()
    assert retry.disposition is quota.ReservationDisposition.NEW
    assert (retry.request.attempt_count, retry.request.status) == (2, AiRequestStatus.RESERVED)
    assert (current_quota.used_count, current_quota.reserved_count) == (0, 1)


def test_expired_reservation_is_reclaimed_before_active_request_check(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    first = quota.reserve_request(
        database_session, user, uuid4(), AiChatMode.TEMPORARY, None, ai_settings(), now
    )

    replacement = quota.reserve_request(
        database_session,
        user,
        uuid4(),
        AiChatMode.TEMPORARY,
        None,
        ai_settings(),
        now + timedelta(seconds=121),
    )

    database_session.refresh(first.request)
    current_quota = database_session.exec(
        select(AiDailyQuota).where(AiDailyQuota.user_id == user.id)
    ).one()
    assert first.request.status is AiRequestStatus.EXPIRED
    assert first.request.failure_code == "RESERVATION_EXPIRED"
    assert replacement.disposition is quota.ReservationDisposition.NEW
    assert current_quota.reserved_count == 1
    expired_log = database_session.exec(
        select(AiUsageLog).where(AiUsageLog.request_id == first.request.id)
    ).one()
    assert (expired_log.attempt_no, expired_log.outcome, expired_log.latency_ms) == (
        1,
        "EXPIRED",
        0,
    )


def test_only_one_active_reservation_is_allowed_per_user(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    quota.reserve_request(
        database_session, user, uuid4(), AiChatMode.TEMPORARY, None, ai_settings(), now
    )

    assert_error(
        "AI_REQUEST_IN_PROGRESS",
        lambda: quota.reserve_request(
            database_session, user, uuid4(), AiChatMode.TEMPORARY, None, ai_settings(), now
        ),
    )


def test_normal_reservation_requires_a_conversation_id(database_session: Session) -> None:
    user = persisted_user(database_session)

    with pytest.raises(ValueError, match="conversation_id"):
        quota.reserve_request(
            database_session,
            user,
            uuid4(),
            AiChatMode.NORMAL,
            None,
            ai_settings(),
            datetime(2026, 7, 29, 12, tzinfo=UTC),
        )


def test_failed_reservation_commit_does_not_leave_quota_or_request_half_state(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)

    assert_error(
        "AI_CONVERSATION_NOT_FOUND",
        lambda: quota.reserve_request(
            database_session,
            user,
            uuid4(),
            AiChatMode.NORMAL,
            uuid4(),
            ai_settings(),
            datetime(2026, 7, 29, 12, tzinfo=UTC),
        ),
    )

    assert database_session.exec(
        select(AiDailyQuota).where(AiDailyQuota.user_id == user.id)
    ).all() == []
    assert database_session.exec(select(AiRequest).where(AiRequest.user_id == user.id)).all() == []


def test_failed_attempt_without_usage_uses_nonnegative_metadata_defaults(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    reserved = quota.reserve_request(
        database_session, user, uuid4(), AiChatMode.TEMPORARY, None, ai_settings(), now
    )

    quota.fail_reservation(database_session, reserved.request, "PROVIDER_TIMEOUT", None, now)

    log = database_session.exec(
        select(AiUsageLog).where(AiUsageLog.request_id == reserved.request.id)
    ).one()
    assert (log.outcome, log.provider, log.model, log.prompt_version, log.latency_ms) == (
        "FAILED",
        "unknown",
        "unknown",
        "unknown",
        0,
    )


def test_repeated_failure_is_idempotent_and_does_not_duplicate_usage(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    reserved = quota.reserve_request(
        database_session, user, uuid4(), AiChatMode.TEMPORARY, None, ai_settings(), now
    )

    quota.fail_reservation(database_session, reserved.request, "PROVIDER_TIMEOUT", None, now)
    quota.fail_reservation(database_session, reserved.request, "PROVIDER_TIMEOUT", None, now)

    current_quota = database_session.exec(
        select(AiDailyQuota).where(AiDailyQuota.user_id == user.id)
    ).one()
    logs = database_session.exec(
        select(AiUsageLog).where(AiUsageLog.request_id == reserved.request.id)
    ).all()
    assert (current_quota.used_count, current_quota.reserved_count) == (0, 0)
    assert [(log.attempt_no, log.outcome) for log in logs] == [(1, "FAILED")]


def test_rolling_minute_counts_the_exact_lower_boundary(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    start = datetime(2026, 7, 29, 12, tzinfo=UTC)
    settings = ai_settings(ai_requests_per_minute=10)

    database_session.add(
        AiDailyQuota(
            user_id=user.id,
            quota_date=quota_date(start),
            free_limit=50,
            used_count=10,
            reserved_count=0,
        )
    )
    requests = [
        AiRequest(
            user_id=user.id,
            client_message_id=uuid4(),
            mode=AiChatMode.TEMPORARY,
            status=AiRequestStatus.SUCCEEDED,
            quota_date=quota_date(start),
            created_at=start,
            completed_at=start,
        )
        for _ in range(10)
    ]
    database_session.add_all(requests)
    database_session.flush()
    database_session.add_all(
        [
            AiUsageLog(
                request_id=request.id,
                attempt_no=1,
                user_id=user.id,
                mode=AiChatMode.TEMPORARY,
                outcome="SUCCEEDED",
                provider="development",
                model="beiyu-development-v1",
                prompt_version="v1",
                latency_ms=0,
                created_at=start,
            )
            for request in requests
        ]
    )
    database_session.flush()

    assert_error(
        "AI_RATE_LIMITED",
        lambda: quota.reserve_request(
            database_session,
            user,
            uuid4(),
            AiChatMode.TEMPORARY,
            None,
            settings,
            start + timedelta(seconds=60),
        ),
    )
    accepted = quota.reserve_request(
        database_session,
        user,
        uuid4(),
        AiChatMode.TEMPORARY,
        None,
        settings,
        start + timedelta(seconds=60, microseconds=1),
    )
    assert accepted.disposition is quota.ReservationDisposition.NEW


def test_normal_success_replays_persisted_response_and_temporary_success_is_lost(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    conversation = AiConversation(user_id=user.id)
    database_session.add(conversation)
    database_session.flush()
    response = AiMessage(
        conversation_id=conversation.id,
        user_id=user.id,
        role=AiMessageRole.ASSISTANT,
        content="持久化回复",
    )
    database_session.add(response)
    database_session.flush()
    normal_id = uuid4()
    normal = quota.reserve_request(
        database_session,
        user,
        normal_id,
        AiChatMode.NORMAL,
        conversation.id,
        ai_settings(),
        now,
    )
    quota.complete_reservation(
        database_session,
        normal.request,
        usage(response_message_id=response.id),
        now,
    )
    replay = quota.reserve_request(
        database_session,
        user,
        normal_id,
        AiChatMode.NORMAL,
        conversation.id,
        ai_settings(),
        now + timedelta(seconds=1),
    )
    temporary_id = uuid4()
    temporary = quota.reserve_request(
        database_session,
        user,
        temporary_id,
        AiChatMode.TEMPORARY,
        None,
        ai_settings(),
        now + timedelta(seconds=1),
    )
    quota.complete_reservation(database_session, temporary.request, usage(), now)
    lost = quota.reserve_request(
        database_session,
        user,
        temporary_id,
        AiChatMode.TEMPORARY,
        None,
        ai_settings(),
        now + timedelta(seconds=2),
    )

    assert (replay.disposition, replay.response_message_id) == (
        quota.ReservationDisposition.REPLAY,
        response.id,
    )
    assert lost.disposition is quota.ReservationDisposition.TEMPORARY_LOST


def test_repeated_terminal_calls_are_idempotent_and_do_not_duplicate_usage(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    reserved = quota.reserve_request(
        database_session, user, uuid4(), AiChatMode.TEMPORARY, None, ai_settings(), now
    )

    first = quota.complete_reservation(database_session, reserved.request, usage(), now)
    second = quota.complete_reservation(database_session, reserved.request, usage(), now)

    current_quota = database_session.exec(
        select(AiDailyQuota).where(AiDailyQuota.user_id == user.id)
    ).one()
    logs = database_session.exec(
        select(AiUsageLog).where(AiUsageLog.request_id == reserved.request.id)
    ).all()
    assert (first.messages_used_today, second.messages_used_today) == (1, 1)
    assert (current_quota.used_count, current_quota.reserved_count) == (1, 0)
    assert [log.attempt_no for log in logs] == [1]


def test_stale_cross_day_normal_completion_charges_the_retried_request_quota() -> None:
    engine = get_engine()
    day_one = datetime(2026, 7, 29, 15, 59, tzinfo=UTC)
    day_two = datetime(2026, 7, 29, 16, tzinfo=UTC)
    client_message_id = uuid4()
    user_id: UUID | None = None
    stale_session = Session(engine, expire_on_commit=False)
    try:
        with Session(engine) as setup:
            user = persisted_user(setup)
            conversation = AiConversation(user_id=user.id)
            setup.add(conversation)
            setup.flush()
            response = AiMessage(
                conversation_id=conversation.id,
                user_id=user.id,
                role=AiMessageRole.ASSISTANT,
                content="跨日重试后的回复",
            )
            setup.add(response)
            setup.commit()
            user_id = user.id
            conversation_id = conversation.id
            response_message_id = response.id

        stale_user = stale_session.get(User, user_id)
        assert stale_user is not None
        first = quota.reserve_request(
            stale_session,
            stale_user,
            client_message_id,
            AiChatMode.NORMAL,
            conversation_id,
            ai_settings(),
            day_one,
        )
        quota.fail_reservation(
            stale_session,
            first.request,
            "PROVIDER_TIMEOUT",
            usage(outcome="FAILED"),
            day_one,
        )
        stale_session.commit()
        stale_request = first.request
        assert stale_request.quota_date == quota_date(day_one)

        with Session(engine) as retry_session:
            retry_user = retry_session.get(User, user_id)
            assert retry_user is not None
            retry = quota.reserve_request(
                retry_session,
                retry_user,
                client_message_id,
                AiChatMode.NORMAL,
                conversation_id,
                ai_settings(),
                day_two,
            )
            retry_session.commit()
            assert retry.request.quota_date == quota_date(day_two)

        with Session(engine) as finalize_session:
            snapshot = quota.complete_reservation(
                finalize_session,
                stale_request,
                usage(response_message_id=response_message_id),
                day_two,
            )
            finalize_session.commit()

        with Session(engine) as verify:
            quotas = {
                row.quota_date: row
                for row in verify.exec(
                    select(AiDailyQuota).where(AiDailyQuota.user_id == user_id)
                ).all()
            }
            request = verify.exec(
                select(AiRequest).where(
                    AiRequest.user_id == user_id,
                    AiRequest.client_message_id == client_message_id,
                )
            ).one()
            logs = verify.exec(
                select(AiUsageLog)
                .where(AiUsageLog.request_id == request.id)
                .order_by("attempt_no")
            ).all()

        assert (quotas[quota_date(day_one)].used_count, quotas[quota_date(day_one)].reserved_count) == (
            0,
            0,
        )
        assert (quotas[quota_date(day_two)].used_count, quotas[quota_date(day_two)].reserved_count) == (
            1,
            0,
        )
        assert (request.status, request.quota_date, request.attempt_count) == (
            AiRequestStatus.SUCCEEDED,
            quota_date(day_two),
            2,
        )
        assert [(log.attempt_no, log.outcome) for log in logs] == [
            (1, "FAILED"),
            (2, "SUCCEEDED"),
        ]
        assert snapshot.messages_used_today == 1
    finally:
        stale_session.close()
        if user_id is not None:
            with Session(engine) as cleanup:
                user = cleanup.get(User, user_id)
                if user is not None:
                    cleanup.delete(user)
                    cleanup.commit()


def test_stale_cross_day_failure_releases_the_retried_request_quota() -> None:
    engine = get_engine()
    day_one = datetime(2026, 7, 29, 15, 59, tzinfo=UTC)
    day_two = datetime(2026, 7, 29, 16, tzinfo=UTC)
    client_message_id = uuid4()
    user_id: UUID | None = None
    stale_session = Session(engine, expire_on_commit=False)
    try:
        with Session(engine) as setup:
            user = persisted_user(setup)
            setup.commit()
            user_id = user.id

        stale_user = stale_session.get(User, user_id)
        assert stale_user is not None
        first = quota.reserve_request(
            stale_session,
            stale_user,
            client_message_id,
            AiChatMode.TEMPORARY,
            None,
            ai_settings(),
            day_one,
        )
        quota.fail_reservation(
            stale_session,
            first.request,
            "PROVIDER_TIMEOUT",
            usage(outcome="FAILED"),
            day_one,
        )
        stale_session.commit()
        stale_request = first.request
        assert stale_request.quota_date == quota_date(day_one)

        with Session(engine) as retry_session:
            retry_user = retry_session.get(User, user_id)
            assert retry_user is not None
            retry = quota.reserve_request(
                retry_session,
                retry_user,
                client_message_id,
                AiChatMode.TEMPORARY,
                None,
                ai_settings(),
                day_two,
            )
            retry_session.commit()
            assert retry.request.quota_date == quota_date(day_two)

        with Session(engine) as finalize_session:
            quota.fail_reservation(
                finalize_session,
                stale_request,
                "PROVIDER_UNAVAILABLE",
                usage(outcome="FAILED"),
                day_two,
            )
            finalize_session.commit()

        with Session(engine) as verify:
            quotas = {
                row.quota_date: row
                for row in verify.exec(
                    select(AiDailyQuota).where(AiDailyQuota.user_id == user_id)
                ).all()
            }
            request = verify.exec(
                select(AiRequest).where(
                    AiRequest.user_id == user_id,
                    AiRequest.client_message_id == client_message_id,
                )
            ).one()
            logs = verify.exec(
                select(AiUsageLog)
                .where(AiUsageLog.request_id == request.id)
                .order_by("attempt_no")
            ).all()

        assert (quotas[quota_date(day_one)].used_count, quotas[quota_date(day_one)].reserved_count) == (
            0,
            0,
        )
        assert (quotas[quota_date(day_two)].used_count, quotas[quota_date(day_two)].reserved_count) == (
            0,
            0,
        )
        assert (request.status, request.quota_date, request.attempt_count) == (
            AiRequestStatus.FAILED,
            quota_date(day_two),
            2,
        )
        assert [(log.attempt_no, log.outcome) for log in logs] == [
            (1, "FAILED"),
            (2, "FAILED"),
        ]
    finally:
        stale_session.close()
        if user_id is not None:
            with Session(engine) as cleanup:
                user = cleanup.get(User, user_id)
                if user is not None:
                    cleanup.delete(user)
                    cleanup.commit()


def test_finalizer_revalidates_when_a_retry_moves_the_request_to_the_next_day(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    engine = get_engine()
    day_one = datetime(2026, 7, 29, 15, 59, tzinfo=UTC)
    day_two = datetime(2026, 7, 29, 16, tzinfo=UTC)
    client_message_id = uuid4()
    user_id: UUID | None = None
    stale_session = Session(engine, expire_on_commit=False)
    try:
        with Session(engine) as setup:
            user = persisted_user(setup)
            setup.commit()
            user_id = user.id

        stale_user = stale_session.get(User, user_id)
        assert stale_user is not None
        first = quota.reserve_request(
            stale_session,
            stale_user,
            client_message_id,
            AiChatMode.TEMPORARY,
            None,
            ai_settings(),
            day_one,
        )
        quota.fail_reservation(
            stale_session,
            first.request,
            "PROVIDER_TIMEOUT",
            usage(outcome="FAILED"),
            day_one,
        )
        stale_session.commit()

        original_candidate = quota._request_lock_candidate
        candidate_reads = 0

        def retry_after_first_candidate(session: Session, request_id: UUID) -> AiRequest | None:
            nonlocal candidate_reads
            candidate = original_candidate(session, request_id)
            candidate_reads += 1
            if candidate_reads == 1:
                with Session(engine) as retry_session:
                    retry_user = retry_session.get(User, user_id)
                    assert retry_user is not None
                    quota.reserve_request(
                        retry_session,
                        retry_user,
                        client_message_id,
                        AiChatMode.TEMPORARY,
                        None,
                        ai_settings(),
                        day_two,
                    )
                    retry_session.commit()
            return candidate

        monkeypatch.setattr(quota, "_request_lock_candidate", retry_after_first_candidate)

        with Session(engine) as finalize_session:
            quota.fail_reservation(
                finalize_session,
                first.request,
                "PROVIDER_UNAVAILABLE",
                usage(outcome="FAILED"),
                day_two,
            )
            finalize_session.commit()

        with Session(engine) as verify:
            quotas = {
                row.quota_date: row
                for row in verify.exec(
                    select(AiDailyQuota).where(AiDailyQuota.user_id == user_id)
                ).all()
            }
            request = verify.exec(
                select(AiRequest).where(
                    AiRequest.user_id == user_id,
                    AiRequest.client_message_id == client_message_id,
                )
            ).one()
            logs = verify.exec(
                select(AiUsageLog)
                .where(AiUsageLog.request_id == request.id)
                .order_by("attempt_no")
            ).all()

        assert candidate_reads == 2
        assert (quotas[quota_date(day_one)].used_count, quotas[quota_date(day_one)].reserved_count) == (
            0,
            0,
        )
        assert (quotas[quota_date(day_two)].used_count, quotas[quota_date(day_two)].reserved_count) == (
            0,
            0,
        )
        assert (request.status, request.quota_date, request.attempt_count) == (
            AiRequestStatus.FAILED,
            quota_date(day_two),
            2,
        )
        assert [(log.attempt_no, log.outcome) for log in logs] == [
            (1, "FAILED"),
            (2, "FAILED"),
        ]
    finally:
        stale_session.close()
        if user_id is not None:
            with Session(engine) as cleanup:
                user = cleanup.get(User, user_id)
                if user is not None:
                    cleanup.delete(user)
                    cleanup.commit()


def test_concurrent_first_reservations_create_one_quota_row_and_one_active_request() -> None:
    engine = get_engine()
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    with Session(engine) as setup:
        user = persisted_user(setup)
        user_id = user.id
        setup.commit()

    barrier = Barrier(2)

    def reserve_in_own_transaction() -> str:
        with Session(engine) as session:
            session.connection().execute(text("SET LOCAL lock_timeout = '2s'"))
            user = session.get(User, user_id)
            assert user is not None
            barrier.wait(timeout=5)
            try:
                result = quota.reserve_request(
                    session, user, uuid4(), AiChatMode.TEMPORARY, None, ai_settings(), now
                )
                session.commit()
                return result.disposition.value
            except AppError as error:
                session.rollback()
                return error.code

    executor = ThreadPoolExecutor(max_workers=2)
    try:
        outcomes = list(executor.map(lambda _: reserve_in_own_transaction(), range(2)))
        with Session(engine) as verify:
            quotas = verify.exec(
                select(AiDailyQuota).where(AiDailyQuota.user_id == user_id)
            ).all()
            requests = verify.exec(select(AiRequest).where(AiRequest.user_id == user_id)).all()
        assert sorted(outcomes) == ["AI_REQUEST_IN_PROGRESS", "NEW"]
        assert [(row.used_count, row.reserved_count) for row in quotas] == [(0, 1)]
        assert [request.status for request in requests] == [AiRequestStatus.RESERVED]
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
        with Session(engine) as cleanup:
            user = cleanup.get(User, user_id)
            if user is not None:
                cleanup.delete(user)
                cleanup.commit()


def test_reservation_rejects_dirty_caller_session_without_committing_its_work(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    pending_user = User(
        phone_hash=f"pending-{uuid4().hex}",
        phone_masked="+86138****1000",
    )
    database_session.add(pending_user)

    assert_error(
        "AI_RESERVATION_TRANSACTION_DIRTY",
        lambda: quota.reserve_request(
            database_session,
            user,
            uuid4(),
            AiChatMode.TEMPORARY,
            None,
            ai_settings(),
            datetime(2026, 7, 29, 12, tzinfo=UTC),
        ),
    )

    assert pending_user in database_session.new


def test_reservation_is_invisible_until_its_caller_commits() -> None:
    engine = get_engine()
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    with Session(engine) as setup:
        user = persisted_user(setup)
        user_id = user.id
        setup.commit()

    try:
        with Session(engine) as reserving:
            user = reserving.get(User, user_id)
            assert user is not None
            result = quota.reserve_request(
                reserving,
                user,
                uuid4(),
                AiChatMode.TEMPORARY,
                None,
                ai_settings(),
                now,
            )
            request_id = result.request.id
            with Session(engine) as observer:
                assert observer.exec(
                    select(AiRequest).where(AiRequest.id == request_id)
                ).first() is None

            reserving.commit()

            with Session(engine) as observer:
                assert observer.exec(
                    select(AiRequest).where(AiRequest.id == request_id)
                ).first() is not None
    finally:
        with Session(engine) as cleanup:
            user = cleanup.get(User, user_id)
            if user is not None:
                cleanup.delete(user)
                cleanup.commit()


def test_normal_completion_rejects_response_from_another_user_or_wrong_role(
    database_session: Session,
) -> None:
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    user = persisted_user(database_session)
    other_user = persisted_user(database_session)
    conversation = AiConversation(user_id=user.id)
    other_conversation = AiConversation(user_id=other_user.id)
    database_session.add_all([conversation, other_conversation])
    database_session.flush()
    foreign_response = AiMessage(
        conversation_id=other_conversation.id,
        user_id=other_user.id,
        role=AiMessageRole.ASSISTANT,
        content="不属于当前请求",
    )
    user_message = AiMessage(
        conversation_id=conversation.id,
        user_id=user.id,
        role=AiMessageRole.USER,
        content="用户消息不能作为回复",
    )
    valid_response = AiMessage(
        conversation_id=conversation.id,
        user_id=user.id,
        role=AiMessageRole.ASSISTANT,
        content="合法回复",
    )
    database_session.add_all([foreign_response, user_message, valid_response])
    database_session.flush()
    reserved = quota.reserve_request(
        database_session,
        user,
        uuid4(),
        AiChatMode.NORMAL,
        conversation.id,
        ai_settings(),
        now,
    )

    for response_id in (foreign_response.id, user_message.id):
        assert_error(
            "AI_REQUEST_RESPONSE_INVALID",
            lambda response_id=response_id: quota.complete_reservation(
                database_session,
                reserved.request,
                usage(response_message_id=response_id),
                now,
            ),
        )
        database_session.refresh(reserved.request)
        assert reserved.request.status is AiRequestStatus.RESERVED

    quota.complete_reservation(
        database_session,
        reserved.request,
        usage(response_message_id=valid_response.id),
        now,
    )
    database_session.refresh(reserved.request)
    assert reserved.request.status is AiRequestStatus.SUCCEEDED


def test_failed_retries_are_rate_limited_before_incrementing_attempt_count(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    client_message_id = uuid4()
    settings = ai_settings(ai_requests_per_minute=10)

    for second in range(10):
        reserved = quota.reserve_request(
            database_session,
            user,
            client_message_id,
            AiChatMode.TEMPORARY,
            None,
            settings,
            now + timedelta(seconds=second),
        )
        quota.fail_reservation(
            database_session,
            reserved.request,
            "PROVIDER_TIMEOUT",
            None,
            now + timedelta(seconds=second),
        )

    assert_error(
        "AI_RATE_LIMITED",
        lambda: quota.reserve_request(
            database_session,
            user,
            client_message_id,
            AiChatMode.TEMPORARY,
            None,
            settings,
            now + timedelta(seconds=10),
        ),
    )
    request = database_session.exec(
        select(AiRequest).where(AiRequest.user_id == user.id)
    ).one()
    assert request.attempt_count == 10


def test_normal_completion_is_invisible_until_caller_commits_exchange_and_quota() -> None:
    engine = get_engine()
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    with Session(engine) as setup:
        user = persisted_user(setup)
        conversation = AiConversation(user_id=user.id)
        setup.add(conversation)
        setup.commit()
        user_id = user.id
        conversation_id = conversation.id
    try:
        with Session(engine) as reserving:
            user = reserving.get(User, user_id)
            assert user is not None
            reserved = quota.reserve_request(
                reserving,
                user,
                uuid4(),
                AiChatMode.NORMAL,
                conversation_id,
                ai_settings(),
                now,
            )
            reserving.commit()
            request_id = reserved.request.id

        with Session(engine) as completing:
            request = completing.get(AiRequest, request_id)
            assert request is not None
            response = AiMessage(
                conversation_id=conversation_id,
                user_id=user_id,
                role=AiMessageRole.ASSISTANT,
                content="同一事务里的回复",
            )
            response_id = response.id
            completing.add(response)
            quota.complete_reservation(
                completing,
                request,
                usage(response_message_id=response_id),
                now,
            )

            with Session(engine) as observer:
                stored_request = observer.get(AiRequest, request_id)
                assert stored_request is not None
                assert stored_request.status is AiRequestStatus.RESERVED
                assert observer.get(AiMessage, response_id) is None

            completing.commit()

        with Session(engine) as observer:
            stored_request = observer.get(AiRequest, request_id)
            assert stored_request is not None
            stored_quota = observer.exec(
                select(AiDailyQuota).where(AiDailyQuota.user_id == user_id)
            ).one()
            assert stored_request.status is AiRequestStatus.SUCCEEDED
            assert stored_request.response_message_id == response_id
            assert observer.get(AiMessage, response_id) is not None
            assert (stored_quota.used_count, stored_quota.reserved_count) == (1, 0)
    finally:
        with Session(engine) as cleanup:
            user = cleanup.get(User, user_id)
            if user is not None:
                cleanup.delete(user)
                cleanup.commit()


def test_concurrent_used_forty_nine_reservations_accept_one_and_reject_one_quota() -> None:
    engine = get_engine()
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    with Session(engine) as setup:
        user = persisted_user(setup)
        setup.add(
            AiDailyQuota(
                user_id=user.id,
                quota_date=quota_date(now),
                free_limit=50,
                used_count=49,
                reserved_count=0,
            )
        )
        setup.commit()
        user_id = user.id
    barrier = Barrier(2)

    def reserve_in_own_transaction() -> str:
        with Session(engine) as session:
            session.connection().execute(text("SET LOCAL lock_timeout = '2s'"))
            user = session.get(User, user_id)
            assert user is not None
            barrier.wait(timeout=5)
            try:
                result = quota.reserve_request(
                    session, user, uuid4(), AiChatMode.TEMPORARY, None, ai_settings(), now
                )
                session.commit()
                return result.disposition.value
            except AppError as error:
                session.rollback()
                return error.code

    executor = ThreadPoolExecutor(max_workers=2)
    try:
        outcomes = list(executor.map(lambda _: reserve_in_own_transaction(), range(2)))
        with Session(engine) as verify:
            stored_quota = verify.exec(
                select(AiDailyQuota).where(AiDailyQuota.user_id == user_id)
            ).one()
            assert sorted(outcomes) == ["AI_DAILY_QUOTA_EXHAUSTED", "NEW"]
            assert stored_quota.used_count + stored_quota.reserved_count == 50
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
        with Session(engine) as cleanup:
            user = cleanup.get(User, user_id)
            if user is not None:
                cleanup.delete(user)
                cleanup.commit()


def test_concurrent_expiry_reclaim_and_completion_have_no_deadlock_or_double_release() -> None:
    engine = get_engine()
    start = datetime(2026, 7, 29, 12, tzinfo=UTC)
    race_now = start + timedelta(seconds=121)
    with Session(engine) as setup:
        user = persisted_user(setup)
        user_id = user.id
        reserved = quota.reserve_request(
            setup,
            user,
            uuid4(),
            AiChatMode.TEMPORARY,
            None,
            ai_settings(),
            start,
        )
        setup.commit()
        request_id = reserved.request.id
        request = setup.get(AiRequest, request_id)
        assert request is not None
        request.reservation_expires_at = race_now
        setup.commit()
    barrier = Barrier(2)

    def complete_in_own_transaction() -> str:
        with Session(engine) as session:
            session.connection().execute(text("SET LOCAL lock_timeout = '2s'"))
            request = session.get(AiRequest, request_id)
            assert request is not None
            barrier.wait(timeout=5)
            try:
                quota.complete_reservation(session, request, None, race_now)
                session.commit()
                return "SUCCEEDED"
            except AppError as error:
                session.rollback()
                return error.code

    def reclaim_in_own_transaction() -> str:
        with Session(engine) as session:
            session.connection().execute(text("SET LOCAL lock_timeout = '2s'"))
            user = session.get(User, user_id)
            assert user is not None
            barrier.wait(timeout=5)
            try:
                result = quota.reserve_request(
                    session,
                    user,
                    uuid4(),
                    AiChatMode.TEMPORARY,
                    None,
                    ai_settings(),
                    race_now,
                )
                session.commit()
                return result.disposition.value
            except AppError as error:
                session.rollback()
                return error.code

    executor = ThreadPoolExecutor(max_workers=2)
    try:
        completion, reclaim = list(
            executor.map(lambda action: action(), [complete_in_own_transaction, reclaim_in_own_transaction])
        )
        with Session(engine) as verify:
            stored_quota = verify.exec(
                select(AiDailyQuota).where(AiDailyQuota.user_id == user_id)
            ).one()
            assert completion in {"SUCCEEDED", "AI_REQUEST_NOT_ACTIVE"}
            assert reclaim == "NEW"
            assert stored_quota.reserved_count == 1
            assert 0 <= stored_quota.used_count <= 1
            assert stored_quota.used_count + stored_quota.reserved_count <= 50
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
        with Session(engine) as cleanup:
            user = cleanup.get(User, user_id)
            if user is not None:
                cleanup.delete(user)
                cleanup.commit()
