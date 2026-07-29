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
    AiConversation,
    AiDailyQuota,
    AiMessage,
    AiMessageRole,
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
    return QuotaSnapshot(
        daily_message_limit=settings.ai_daily_limit,
        messages_used_today=occupied_count,
        remaining=settings.ai_daily_limit - occupied_count,
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


def _usage_or_default(usage: UsageDetails | None, *, outcome: str) -> UsageDetails:
    return usage if usage is not None else UsageDetails(outcome=outcome)


def _require_clean_reservation_session(session: Session) -> None:
    if session.new or session.dirty or session.deleted:
        raise _app_error(
            "AI_RESERVATION_TRANSACTION_DIRTY",
            "请先提交或刷新当前 AI 预留之外的修改",
            409,
        )


def _locked_user_quotas(session: Session, *, user_id: UUID) -> dict[date, AiDailyQuota]:
    quota_date_column = cast(ColumnElement[date], AiDailyQuota.quota_date)
    quotas = session.exec(
        select(AiDailyQuota)
        .where(AiDailyQuota.user_id == user_id)
        .order_by(quota_date_column)
        .with_for_update()
    ).all()
    return {quota.quota_date: quota for quota in quotas}


def _create_or_lock_quota(
    session: Session,
    *,
    quotas: dict[date, AiDailyQuota],
    user_id: UUID,
    day: date,
    free_limit: int,
    now: datetime,
) -> AiDailyQuota:
    existing = quotas.get(day)
    if existing is not None:
        return existing
    try:
        with session.begin_nested():
            quota = AiDailyQuota(
                user_id=user_id,
                quota_date=day,
                free_limit=free_limit,
                created_at=now,
                updated_at=now,
            )
            session.add(quota)
            session.flush()
    except IntegrityError:
        # The savepoint absorbs only the expected unique race.  The caller's
        # transaction and unrelated state remain intact.
        refreshed = _locked_user_quotas(session, user_id=user_id)
        existing = refreshed.get(day)
        if existing is None:
            raise
        quotas.update(refreshed)
        return existing
    quotas[day] = quota
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
    quotas: dict[date, AiDailyQuota],
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
        quota = quotas.get(request.quota_date)
        if quota is None:
            raise RuntimeError("reserved AI request has no quota row")
        if quota.reserved_count <= 0:
            raise RuntimeError("reserved AI request has no reserved quota")
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


def _require_owned_conversation(
    session: Session,
    *,
    user_id: UUID,
    conversation_id: UUID | None,
) -> None:
    if conversation_id is None:
        raise ValueError("normal requests require conversation_id")
    conversation = session.exec(
        select(AiConversation).where(
            AiConversation.id == conversation_id,
            AiConversation.user_id == user_id,
        )
    ).first()
    if conversation is None:
        raise _app_error("AI_CONVERSATION_NOT_FOUND", "AI 对话不存在", 404)


def _attempts_in_window(session: Session, *, user_id: UUID, now: datetime) -> int:
    return len(
        session.exec(
            select(AiUsageLog.id).where(
                AiUsageLog.user_id == user_id,
                AiUsageLog.created_at >= now - timedelta(minutes=1),
            )
        ).all()
    )


def reserve_request(
    session: Session,
    user: User,
    client_message_id: UUID,
    mode: AiChatMode,
    conversation_id: UUID | None,
    settings: Settings,
    now: datetime,
) -> ReservationResult:
    """Reserve a slot without committing; the caller must commit before provider I/O."""
    _require_clean_reservation_session(session)
    now = _utc_now(now)
    if mode is AiChatMode.NORMAL:
        _require_owned_conversation(
            session,
            user_id=user.id,
            conversation_id=conversation_id,
        )
    day = quota_date(now)
    quotas = _locked_user_quotas(session, user_id=user.id)
    quota = _create_or_lock_quota(
        session,
        quotas=quotas,
        user_id=user.id,
        day=day,
        free_limit=settings.ai_daily_limit,
        now=now,
    )
    _reclaim_expired_reservations(session, user_id=user.id, quotas=quotas, now=now)
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
            session.flush()
            return existing_result
    if _attempts_in_window(session, user_id=user.id, now=now) >= settings.ai_requests_per_minute:
        raise _app_error("AI_RATE_LIMITED", "请求过于频繁，请稍后再试", 429)
    if quota.used_count + quota.reserved_count >= quota.free_limit:
        raise _app_error("AI_DAILY_QUOTA_EXHAUSTED", "今日 AI 额度已用完", 429)
    if request is None:
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
    else:
        request.status = AiRequestStatus.RESERVED
        request.attempt_count += 1
        request.quota_date = day
        request.reservation_expires_at = now + timedelta(seconds=settings.ai_reservation_seconds)
        request.failure_code = None
        request.completed_at = None
        request.response_message_id = None
    quota.reserved_count += 1
    quota.updated_at = now
    session.flush()
    return ReservationResult(ReservationDisposition.NEW, request)


def _lock_quota_then_request(session: Session, request: AiRequest) -> tuple[AiDailyQuota, AiRequest]:
    quota = session.exec(
        select(AiDailyQuota)
        .where(
            AiDailyQuota.user_id == request.user_id,
            AiDailyQuota.quota_date == request.quota_date,
        )
        .with_for_update()
    ).first()
    if quota is None:
        raise _app_error("AI_REQUEST_NOT_FOUND", "AI 请求不存在", 404)
    locked_request = session.exec(
        select(AiRequest)
        .where(AiRequest.id == request.id)
        .with_for_update()
        .execution_options(populate_existing=True)
    ).first()
    if (
        locked_request is None
        or locked_request.user_id != request.user_id
        or locked_request.quota_date != request.quota_date
    ):
        raise _app_error("AI_REQUEST_NOT_FOUND", "AI 请求不存在", 404)
    return quota, locked_request


def _validate_normal_response(
    session: Session,
    *,
    request: AiRequest,
    response_message_id: UUID | None,
) -> None:
    if response_message_id is None:
        raise _app_error("AI_REQUEST_RESPONSE_INVALID", "AI 回复状态无效", 409)
    response = session.exec(
        select(AiMessage).where(AiMessage.id == response_message_id).with_for_update()
    ).first()
    if (
        response is None
        or response.role is not AiMessageRole.ASSISTANT
        or response.user_id != request.user_id
        or response.conversation_id != request.conversation_id
    ):
        raise _app_error("AI_REQUEST_RESPONSE_INVALID", "AI 回复状态无效", 409)


def complete_reservation(
    session: Session,
    request: AiRequest,
    usage: UsageDetails | None,
    now: datetime,
) -> QuotaSnapshot:
    """Finish a reservation in the caller's transaction without committing it."""
    now = _utc_now(now)
    usage = _usage_or_default(usage, outcome="SUCCEEDED")
    quota, locked_request = _lock_quota_then_request(session, request)
    if locked_request.status is AiRequestStatus.SUCCEEDED:
        return _snapshot_for_quota(quota, now)
    if locked_request.status is not AiRequestStatus.RESERVED:
        raise _app_error("AI_REQUEST_NOT_ACTIVE", "AI 请求不在可完成状态", 409)
    if quota.reserved_count <= 0:
        raise RuntimeError("reserved AI request has no reserved quota")
    if locked_request.mode is AiChatMode.TEMPORARY:
        if usage.response_message_id is not None:
            raise _app_error("AI_REQUEST_RESPONSE_INVALID", "AI 回复状态无效", 409)
    else:
        _validate_normal_response(
            session,
            request=locked_request,
            response_message_id=usage.response_message_id,
        )
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
    session.flush()
    return _snapshot_for_quota(quota, now)


def fail_reservation(
    session: Session,
    request: AiRequest,
    failure_code: str,
    usage: UsageDetails | None,
    now: datetime,
) -> None:
    """Fail a reservation in the caller's transaction without committing it."""
    now = _utc_now(now)
    usage = _usage_or_default(usage, outcome="FAILED")
    quota, locked_request = _lock_quota_then_request(session, request)
    if locked_request.status in {AiRequestStatus.FAILED, AiRequestStatus.EXPIRED}:
        return
    if locked_request.status is AiRequestStatus.SUCCEEDED:
        raise _app_error("AI_REQUEST_NOT_ACTIVE", "AI 请求已经完成", 409)
    if quota.reserved_count <= 0:
        raise RuntimeError("reserved AI request has no reserved quota")
    quota.reserved_count -= 1
    quota.updated_at = now
    locked_request.status = AiRequestStatus.FAILED
    locked_request.reservation_expires_at = None
    locked_request.completed_at = now
    locked_request.failure_code = failure_code[:80]
    locked_request.safety_label = usage.safety_label
    _write_usage_log(session, request=locked_request, usage=usage, now=now)
    session.flush()
