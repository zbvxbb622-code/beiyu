from dataclasses import dataclass
from datetime import UTC, date, datetime, time, timedelta
from decimal import Decimal
from enum import StrEnum
from typing import cast
from uuid import UUID
from zoneinfo import ZoneInfo

from sqlalchemy import ColumnElement
from sqlalchemy.exc import IntegrityError
from sqlmodel import Session, select

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import (
    AiChatMode,
    AiDailyQuota,
    AiRequest,
    AiRequestStatus,
    AiSafetyLabel,
    AiUsageLog,
    User,
)

BEIJING_TIME_ZONE = ZoneInfo("Asia/Shanghai")
RESERVATION_EXPIRED = "RESERVATION_EXPIRED"


class ReservationDisposition(StrEnum):
    NEW = "NEW"
    REPLAY = "REPLAY"
    IN_PROGRESS = "IN_PROGRESS"
    TEMPORARY_LOST = "TEMPORARY_LOST"


@dataclass(frozen=True)
class ReservationResult:
    disposition: ReservationDisposition
    request: AiRequest
    response_message_id: UUID | None = None


@dataclass(frozen=True)
class UsageDetails:
    """Provider metadata only; message and prompt text are intentionally absent."""

    outcome: str = "SUCCEEDED"
    provider: str = "unknown"
    model: str = "unknown"
    prompt_version: str = "unknown"
    latency_ms: int = 0
    input_tokens: int | None = None
    output_tokens: int | None = None
    cost_estimate: Decimal | None = None
    safety_label: AiSafetyLabel | None = None
    response_message_id: UUID | None = None


def _usage_or_default(
    usage: UsageDetails | None,
    *,
    outcome: str,
) -> UsageDetails:
    return usage if usage is not None else UsageDetails(outcome=outcome)


@dataclass(frozen=True)
class QuotaSnapshot:
    daily_message_limit: int
    messages_used_today: int
    remaining: int
    resets_at: datetime


def _utc_now(now: datetime) -> datetime:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(UTC)


def quota_date(now: datetime) -> date:
    return _utc_now(now).astimezone(BEIJING_TIME_ZONE).date()


def next_reset(now: datetime) -> datetime:
    local_now = _utc_now(now).astimezone(BEIJING_TIME_ZONE)
    next_day = local_now.date() + timedelta(days=1)
    return datetime.combine(next_day, time.min, BEIJING_TIME_ZONE).astimezone(UTC)


def quota_snapshot(
    session: Session,
    user_id: UUID,
    settings: Settings,
    now: datetime,
) -> QuotaSnapshot:
    today = quota_date(now)
    with session.no_autoflush:
        quota = session.exec(
            select(AiDailyQuota).where(
                AiDailyQuota.user_id == user_id,
                AiDailyQuota.quota_date == today,
            )
        ).first()
    used_count = max(0, quota.used_count) if quota is not None else 0
    reserved_count = max(0, quota.reserved_count) if quota is not None else 0
    occupied_count = min(settings.ai_daily_limit, used_count + reserved_count)
    remaining = settings.ai_daily_limit - occupied_count
    return QuotaSnapshot(
        daily_message_limit=settings.ai_daily_limit,
        messages_used_today=occupied_count,
        remaining=remaining,
        resets_at=next_reset(now),
    )


def _snapshot_for_quota(quota: AiDailyQuota, now: datetime) -> QuotaSnapshot:
    occupied_count = min(quota.free_limit, max(0, quota.used_count + quota.reserved_count))
    return QuotaSnapshot(
        daily_message_limit=quota.free_limit,
        messages_used_today=occupied_count,
        remaining=quota.free_limit - occupied_count,
        resets_at=next_reset(now),
    )


def _app_error(code: str, message: str, status_code: int) -> AppError:
    return AppError(code=code, message=message, status_code=status_code)


def _locked_quota(
    session: Session,
    *,
    user_id: UUID,
    day: date,
) -> AiDailyQuota | None:
    return session.exec(
        select(AiDailyQuota)
        .where(AiDailyQuota.user_id == user_id, AiDailyQuota.quota_date == day)
        .with_for_update()
    ).first()


def _get_or_create_locked_quota(
    session: Session,
    *,
    user_id: UUID,
    day: date,
    free_limit: int,
    now: datetime,
) -> AiDailyQuota:
    quota = _locked_quota(session, user_id=user_id, day=day)
    if quota is not None:
        return quota

    quota = AiDailyQuota(
        user_id=user_id,
        quota_date=day,
        free_limit=free_limit,
        created_at=now,
        updated_at=now,
    )
    session.add(quota)
    # The unique constraint is the cross-process creation arbiter.  The caller
    # retries the complete transaction if another process wins this insert.
    session.flush()
    return quota


def _write_usage_log(
    session: Session,
    *,
    request: AiRequest,
    usage: UsageDetails,
    now: datetime,
) -> None:
    session.add(
        AiUsageLog(
            request_id=request.id,
            attempt_no=request.attempt_count,
            user_id=request.user_id,
            conversation_id=request.conversation_id,
            mode=request.mode,
            outcome=usage.outcome[:40],
            provider=usage.provider[:80],
            model=usage.model[:120],
            prompt_version=usage.prompt_version[:40],
            input_tokens=(max(0, usage.input_tokens) if usage.input_tokens is not None else None),
            output_tokens=(
                max(0, usage.output_tokens) if usage.output_tokens is not None else None
            ),
            latency_ms=max(0, usage.latency_ms),
            cost_estimate=(
                max(Decimal(0), usage.cost_estimate)
                if usage.cost_estimate is not None
                else None
            ),
            safety_label=usage.safety_label,
            created_at=now,
        )
    )


def _reclaim_expired_reservations(
    session: Session,
    *,
    user_id: UUID,
    now: datetime,
) -> None:
    reservation_expires_at = cast(
        ColumnElement[datetime],
        AiRequest.reservation_expires_at,
    )
    expired = session.exec(
        select(AiRequest)
        .where(
            AiRequest.user_id == user_id,
            AiRequest.status == AiRequestStatus.RESERVED,
            reservation_expires_at.is_not(None),
            reservation_expires_at <= now,
        )
        .with_for_update()
    ).all()
    for request in expired:
        quota = _locked_quota(session, user_id=user_id, day=request.quota_date)
        if quota is not None and quota.reserved_count > 0:
            quota.reserved_count -= 1
            quota.updated_at = now
        request.status = AiRequestStatus.EXPIRED
        request.failure_code = RESERVATION_EXPIRED
        request.completed_at = now
        request.reservation_expires_at = None
        _write_usage_log(
            session,
            request=request,
            usage=UsageDetails(outcome="EXPIRED"),
            now=now,
        )


def _existing_reservation_result(request: AiRequest) -> ReservationResult | None:
    if request.status is AiRequestStatus.RESERVED:
        return ReservationResult(ReservationDisposition.IN_PROGRESS, request)
    if request.status is AiRequestStatus.SUCCEEDED:
        if request.mode is AiChatMode.TEMPORARY:
            return ReservationResult(ReservationDisposition.TEMPORARY_LOST, request)
        return ReservationResult(
            ReservationDisposition.REPLAY,
            request,
            request.response_message_id,
        )
    return None


def _reserve_request_once(
    session: Session,
    user: User,
    client_message_id: UUID,
    mode: AiChatMode,
    conversation_id: UUID | None,
    settings: Settings,
    now: datetime,
) -> ReservationResult:
    day = quota_date(now)
    quota = _get_or_create_locked_quota(
        session,
        user_id=user.id,
        day=day,
        free_limit=settings.ai_daily_limit,
        now=now,
    )
    _reclaim_expired_reservations(session, user_id=user.id, now=now)
    request = session.exec(
        select(AiRequest)
        .where(
            AiRequest.user_id == user.id,
            AiRequest.client_message_id == client_message_id,
        )
        .with_for_update()
    ).first()
    if request is not None:
        existing_result = _existing_reservation_result(request)
        if existing_result is not None:
            session.commit()
            return existing_result
        if quota.used_count + quota.reserved_count >= quota.free_limit:
            raise _app_error("AI_DAILY_QUOTA_EXHAUSTED", "今日 AI 额度已用完", 429)
        request.status = AiRequestStatus.RESERVED
        request.attempt_count += 1
        request.quota_date = day
        request.reservation_expires_at = now + timedelta(
            seconds=settings.ai_reservation_seconds
        )
        request.failure_code = None
        request.completed_at = None
        request.response_message_id = None
        quota.reserved_count += 1
        quota.updated_at = now
        session.commit()
        return ReservationResult(ReservationDisposition.NEW, request)

    active_request = session.exec(
        select(AiRequest)
        .where(
            AiRequest.user_id == user.id,
            AiRequest.status == AiRequestStatus.RESERVED,
        )
        .with_for_update()
    ).first()
    if active_request is not None:
        raise _app_error("AI_REQUEST_IN_PROGRESS", "已有 AI 请求正在处理中", 409)
    requests_in_window = session.exec(
        select(AiRequest.id).where(
            AiRequest.user_id == user.id,
            AiRequest.created_at >= now - timedelta(minutes=1),
        )
    ).all()
    if len(requests_in_window) >= settings.ai_requests_per_minute:
        raise _app_error("AI_RATE_LIMITED", "请求过于频繁，请稍后再试", 429)
    if quota.used_count + quota.reserved_count >= quota.free_limit:
        raise _app_error("AI_DAILY_QUOTA_EXHAUSTED", "今日 AI 额度已用完", 429)
    request = AiRequest(
        user_id=user.id,
        conversation_id=conversation_id,
        client_message_id=client_message_id,
        mode=mode,
        quota_date=day,
        reservation_expires_at=now + timedelta(seconds=settings.ai_reservation_seconds),
        created_at=now,
    )
    session.add(request)
    quota.reserved_count += 1
    quota.updated_at = now
    session.commit()
    return ReservationResult(ReservationDisposition.NEW, request)


def reserve_request(
    session: Session,
    user: User,
    client_message_id: UUID,
    mode: AiChatMode,
    conversation_id: UUID | None,
    settings: Settings,
    now: datetime,
) -> ReservationResult:
    """Atomically reserve one request slot using database locks and uniqueness."""
    if mode is AiChatMode.NORMAL and conversation_id is None:
        raise ValueError("normal requests require conversation_id")
    now = _utc_now(now)
    for _ in range(2):
        try:
            return _reserve_request_once(
                session,
                user,
                client_message_id,
                mode,
                conversation_id,
                settings,
                now,
            )
        except IntegrityError:
            session.rollback()
    raise _app_error("AI_REQUEST_CONFLICT", "AI 请求并发冲突，请重试", 409)


def _locked_request(session: Session, request_id: UUID) -> AiRequest:
    request = session.exec(
        select(AiRequest).where(AiRequest.id == request_id).with_for_update()
    ).first()
    if request is None:
        raise _app_error("AI_REQUEST_NOT_FOUND", "AI 请求不存在", 404)
    return request


def _locked_request_quota(session: Session, request: AiRequest) -> AiDailyQuota:
    quota = _locked_quota(session, user_id=request.user_id, day=request.quota_date)
    if quota is None:
        raise RuntimeError("reserved AI request has no quota row")
    return quota


def complete_reservation(
    session: Session,
    request: AiRequest,
    usage: UsageDetails | None,
    now: datetime,
) -> QuotaSnapshot:
    """Complete one reserved attempt, releasing exactly one slot in a short transaction."""
    now = _utc_now(now)
    usage = _usage_or_default(usage, outcome="SUCCEEDED")
    locked_request = _locked_request(session, request.id)
    quota = _locked_request_quota(session, locked_request)
    if locked_request.status is AiRequestStatus.SUCCEEDED:
        session.commit()
        return _snapshot_for_quota(quota, now)
    if locked_request.status is not AiRequestStatus.RESERVED:
        session.rollback()
        raise _app_error("AI_REQUEST_NOT_ACTIVE", "AI 请求不在可完成状态", 409)
    if quota.reserved_count <= 0:
        session.rollback()
        raise RuntimeError("reserved AI request has no reserved quota")
    if quota.used_count + quota.reserved_count > quota.free_limit:
        session.rollback()
        raise RuntimeError("AI quota invariant violated")
    if locked_request.mode is AiChatMode.TEMPORARY and usage.response_message_id is not None:
        session.rollback()
        raise ValueError("temporary requests cannot retain response messages")
    quota.reserved_count -= 1
    quota.used_count += 1
    quota.updated_at = now
    locked_request.status = AiRequestStatus.SUCCEEDED
    locked_request.reservation_expires_at = None
    locked_request.completed_at = now
    locked_request.failure_code = None
    locked_request.response_message_id = usage.response_message_id
    locked_request.safety_label = usage.safety_label
    _write_usage_log(session, request=locked_request, usage=usage, now=now)
    session.commit()
    return _snapshot_for_quota(quota, now)


def fail_reservation(
    session: Session,
    request: AiRequest,
    failure_code: str,
    usage: UsageDetails | None,
    now: datetime,
) -> None:
    """Fail one reserved attempt and release its slot without charging usage."""
    now = _utc_now(now)
    usage = _usage_or_default(usage, outcome="FAILED")
    locked_request = _locked_request(session, request.id)
    if locked_request.status in {AiRequestStatus.FAILED, AiRequestStatus.EXPIRED}:
        session.commit()
        return
    if locked_request.status is AiRequestStatus.SUCCEEDED:
        session.rollback()
        raise _app_error("AI_REQUEST_NOT_ACTIVE", "AI 请求已经完成", 409)
    quota = _locked_request_quota(session, locked_request)
    if quota.reserved_count <= 0:
        session.rollback()
        raise RuntimeError("reserved AI request has no reserved quota")
    quota.reserved_count -= 1
    quota.updated_at = now
    locked_request.status = AiRequestStatus.FAILED
    locked_request.reservation_expires_at = None
    locked_request.completed_at = now
    locked_request.failure_code = failure_code[:80]
    locked_request.safety_label = usage.safety_label
    _write_usage_log(session, request=locked_request, usage=usage, now=now)
    session.commit()
