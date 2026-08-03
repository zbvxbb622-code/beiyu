import time
import uuid
from collections.abc import Callable
from datetime import UTC, datetime
from decimal import Decimal
from typing import Any, cast
from uuid import UUID

from sqlalchemy import ColumnElement, inspect
from sqlmodel import Session, select

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import (
    AiChatMode,
    AiConversation,
    AiMessage,
    AiMessageRole,
    AiRequest,
    AiRequestStatus,
    AiSafetyLabel,
    User,
)
from app.integrations.ai.base import (
    AiProvider,
    AiProviderInvalidResponse,
    AiProviderTimeout,
    AiProviderUnavailable,
)
from app.modules.ai.access import require_ai_access
from app.modules.ai.context import (
    build_normal_generation_request,
    build_temporary_generation_request,
)
from app.modules.ai.conversations import (
    SavedExchange,
    conversation_response,
    get_owned_conversation,
    message_response,
    save_exchange,
)
from app.modules.ai.memory import apply_memory_candidates
from app.modules.ai.quota import (
    QuotaSnapshot,
    ReservationDisposition,
    UsageDetails,
    complete_reservation,
    fail_reservation,
    quota_snapshot,
    reserve_request,
)
from app.modules.ai.safety import SafetyDecision, classify_input, review_output
from app.modules.ai.schemas import (
    AiGenerationRequest,
    AiGenerationResult,
    AiMessageResponse,
    AiUsageResponse,
    MemoryChange,
    SendMessageRequest,
    SendMessageResponse,
    TemporaryMessageRequest,
    TemporaryMessageResponse,
)

PROMPT_VERSION = "v1"
SERVER_SAFETY_PROVIDER = "server"
SERVER_SAFETY_MODEL = "safety-rules"


def _utc_now(now: datetime) -> datetime:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(UTC)


def _identity_uuid(instance: User) -> UUID:
    inspection = inspect(instance, raiseerr=False)
    if inspection is not None:
        identity = inspection.identity
        if identity is not None and len(identity) == 1 and isinstance(identity[0], UUID):
            return identity[0]
    value = instance.id
    if not isinstance(value, UUID):
        raise ValueError("model id must be a UUID")
    return value


def _prepare_session(session: Session) -> None:
    if session.new or session.dirty or session.deleted:
        raise RuntimeError("AI orchestrator requires a clean caller session")
    _rollback_if_active(session)
    if session.in_transaction():
        raise RuntimeError("AI orchestrator could not own the caller session")


def _rollback_if_active(session: Session) -> None:
    if session.in_transaction():
        session.rollback()


def _trusted_user(session: Session, user_id: UUID) -> User:
    user = session.exec(
        select(User)
        .where(User.id == user_id)
        .execution_options(populate_existing=True)
    ).first()
    if user is None:
        raise AppError(
            code="AI_ACCESS_SUSPENDED",
            message="账号暂不可使用 AI",
            status_code=403,
        )
    return user


def _request_reference(session: Session, request_id: UUID) -> AiRequest:
    request = session.get(AiRequest, request_id)
    if request is None:
        raise AppError(
            code="AI_REQUEST_NOT_FOUND",
            message="AI 请求不存在",
            status_code=404,
        )
    return request


def _usage_response(snapshot: QuotaSnapshot) -> AiUsageResponse:
    return AiUsageResponse(
        limit=snapshot.daily_message_limit,
        used=snapshot.messages_used_today,
        remaining=snapshot.remaining,
        resets_at=snapshot.resets_at,
    )


def _latency_ms(started_at: float, monotonic: Callable[[], float]) -> int:
    return max(0, int((monotonic() - started_at) * 1_000))


def _provider_usage(
    result: AiGenerationResult,
    *,
    latency_ms: int,
    response_message_id: UUID | None = None,
) -> UsageDetails:
    return UsageDetails(
        outcome="SUCCEEDED",
        provider=result.provider,
        model=result.model,
        prompt_version=PROMPT_VERSION,
        latency_ms=latency_ms,
        input_tokens=result.input_tokens,
        output_tokens=result.output_tokens,
        cost_estimate=(
            Decimal(str(result.cost_estimate))
            if result.cost_estimate is not None
            else None
        ),
        safety_label=result.safety_label,
        response_message_id=response_message_id,
    )


def _server_safety_usage(
    decision: SafetyDecision,
    *,
    response_message_id: UUID | None = None,
) -> UsageDetails:
    return UsageDetails(
        outcome="SUCCEEDED",
        provider=SERVER_SAFETY_PROVIDER,
        model=SERVER_SAFETY_MODEL,
        prompt_version=PROMPT_VERSION,
        latency_ms=0,
        safety_label=decision.label,
        response_message_id=response_message_id,
    )


def _failure_usage(
    settings: Settings,
    *,
    latency_ms: int,
    safety_label: AiSafetyLabel | None,
    provider_called: bool,
) -> UsageDetails:
    return UsageDetails(
        outcome="FAILED",
        provider=(
            settings.ai_provider.value if provider_called else SERVER_SAFETY_PROVIDER
        ),
        model=settings.ai_model if provider_called else SERVER_SAFETY_MODEL,
        prompt_version=PROMPT_VERSION,
        latency_ms=latency_ms,
        safety_label=safety_label,
    )


def _fail_reserved_request(
    session: Session,
    *,
    request_id: UUID,
    failure_code: str,
    usage: UsageDetails,
    now: datetime,
) -> None:
    """Best-effort release that never replaces the original domain error."""
    try:
        _rollback_if_active(session)
        fail_reservation(
            session,
            _request_reference(session, request_id),
            failure_code,
            usage,
            now,
        )
        session.commit()
    except Exception:
        session.rollback()


def _reservation_error(disposition: ReservationDisposition) -> AppError:
    if disposition is ReservationDisposition.IN_PROGRESS:
        return AppError(
            code="AI_REQUEST_IN_PROGRESS",
            message="已有 AI 请求正在处理中",
            status_code=409,
        )
    if disposition is ReservationDisposition.TEMPORARY_LOST:
        return AppError(
            code="TEMPORARY_RESPONSE_NOT_RETAINED",
            message="临时回复无法恢复",
            status_code=409,
        )
    raise RuntimeError(f"unsupported reservation disposition: {disposition}")


def _require_reservation_scope(
    request: AiRequest,
    *,
    mode: AiChatMode,
    conversation_id: UUID | None,
) -> None:
    if request.mode is not mode or request.conversation_id != conversation_id:
        raise AppError(
            code="AI_REQUEST_CONFLICT",
            message="AI 请求与原始发送范围不一致",
            status_code=409,
        )


def _reserve_normal(
    session: Session,
    *,
    user_id: UUID,
    conversation_id: UUID,
    payload: SendMessageRequest,
    settings: Settings,
    now: datetime,
) -> tuple[UUID, ReservationDisposition]:
    try:
        user = _trusted_user(session, user_id)
        require_ai_access(user, settings)
        get_owned_conversation(
            session=session,
            user=user,
            conversation_id=conversation_id,
        )
        reservation = reserve_request(
            session,
            user,
            payload.client_message_id,
            AiChatMode.NORMAL,
            conversation_id,
            settings,
            now,
        )
        _require_reservation_scope(
            reservation.request,
            mode=AiChatMode.NORMAL,
            conversation_id=conversation_id,
        )
        request_id = reservation.request.id
        disposition = reservation.disposition
        session.commit()
        return request_id, disposition
    except Exception:
        _rollback_if_active(session)
        raise


def _reserve_temporary(
    session: Session,
    *,
    user_id: UUID,
    payload: TemporaryMessageRequest,
    settings: Settings,
    now: datetime,
) -> tuple[UUID, ReservationDisposition]:
    try:
        user = _trusted_user(session, user_id)
        require_ai_access(user, settings)
        reservation = reserve_request(
            session,
            user,
            payload.client_message_id,
            AiChatMode.TEMPORARY,
            None,
            settings,
            now,
        )
        _require_reservation_scope(
            reservation.request,
            mode=AiChatMode.TEMPORARY,
            conversation_id=None,
        )
        request_id = reservation.request.id
        disposition = reservation.disposition
        session.commit()
        return request_id, disposition
    except Exception:
        _rollback_if_active(session)
        raise


def _load_normal_replay(
    session: Session,
    *,
    user_id: UUID,
    conversation_id: UUID,
    request_id: UUID,
    settings: Settings,
    now: datetime,
) -> SendMessageResponse:
    try:
        request = session.exec(
            select(AiRequest).where(
                AiRequest.id == request_id,
                AiRequest.user_id == user_id,
                AiRequest.conversation_id == conversation_id,
                AiRequest.mode == AiChatMode.NORMAL,
                AiRequest.status == AiRequestStatus.SUCCEEDED,
            )
        ).first()
        if request is None or request.response_message_id is None:
            raise AppError(
                code="AI_REQUEST_RESPONSE_INVALID",
                message="AI 回复状态无效",
                status_code=409,
            )
        conversation = session.exec(
            select(AiConversation).where(
                AiConversation.id == conversation_id,
                AiConversation.user_id == user_id,
            )
        ).first()
        assistant = session.exec(
            select(AiMessage).where(
                AiMessage.id == request.response_message_id,
                AiMessage.user_id == user_id,
                AiMessage.conversation_id == conversation_id,
                AiMessage.role == AiMessageRole.ASSISTANT,
            )
        ).first()
        if conversation is None or assistant is None:
            raise AppError(
                code="AI_REQUEST_RESPONSE_INVALID",
                message="AI 回复状态无效",
                status_code=409,
            )
        user_message = session.exec(
            select(AiMessage)
            .where(
                AiMessage.user_id == user_id,
                AiMessage.conversation_id == conversation_id,
                AiMessage.role == AiMessageRole.USER,
                AiMessage.created_at < assistant.created_at,
            )
            .order_by(
                cast(ColumnElement[Any], AiMessage.created_at).desc(),
                cast(ColumnElement[Any], AiMessage.id).desc(),
            )
            .limit(1)
        ).first()
        if user_message is None:
            raise AppError(
                code="AI_REQUEST_RESPONSE_INVALID",
                message="AI 回复状态无效",
                status_code=409,
            )
        response = SendMessageResponse(
            conversation=conversation_response(conversation),
            user_message=message_response(user_message),
            assistant_message=message_response(assistant),
            usage=_usage_response(quota_snapshot(session, user_id, settings, now)),
            memory_changes=[],
        )
        session.commit()
        return response
    except Exception:
        _rollback_if_active(session)
        raise


def _normal_context(
    session: Session,
    *,
    user_id: UUID,
    conversation_id: UUID,
    content: str,
    settings: Settings,
) -> tuple[SafetyDecision, AiGenerationRequest]:
    try:
        user = _trusted_user(session, user_id)
        decision = classify_input(content, user)
        conversation = get_owned_conversation(
            session=session,
            user=user,
            conversation_id=conversation_id,
        )
        request = build_normal_generation_request(
            session,
            user,
            conversation,
            content,
            decision,
            settings,
        )
        session.commit()
        return decision, request
    except Exception:
        _rollback_if_active(session)
        raise


def _temporary_context(
    session: Session,
    *,
    user_id: UUID,
    payload: TemporaryMessageRequest,
    settings: Settings,
) -> tuple[SafetyDecision, AiGenerationRequest]:
    try:
        user = _trusted_user(session, user_id)
        decision = classify_input(payload.content, user)
        request = build_temporary_generation_request(
            session,
            user,
            payload.content,
            payload.context,
            decision,
            settings,
        )
        session.commit()
        return decision, request
    except Exception:
        _rollback_if_active(session)
        raise


def _fixed_result(decision: SafetyDecision) -> AiGenerationResult:
    if decision.fixed_reply is None:
        raise RuntimeError("fixed result requires a fixed safety reply")
    return AiGenerationResult(
        reply_text=decision.fixed_reply,
        provider=SERVER_SAFETY_PROVIDER,
        model=SERVER_SAFETY_MODEL,
        safety_label=decision.label,
    )


def _generate_output(
    session: Session,
    *,
    request_id: UUID,
    generation_request: AiGenerationRequest,
    decision: SafetyDecision,
    provider: AiProvider,
    settings: Settings,
    now: datetime,
    monotonic: Callable[[], float],
) -> tuple[AiGenerationResult, int]:
    if decision.fixed_reply is not None:
        return _fixed_result(decision), 0

    started_at = monotonic()
    try:
        generated = provider.generate(generation_request)
        return generated, _latency_ms(started_at, monotonic)
    except AiProviderTimeout:
        latency_ms = _latency_ms(started_at, monotonic)
        error = AppError(
            code="AI_PROVIDER_TIMEOUT",
            message="回复暂时没有生成，请稍后重试",
            status_code=504,
        )
        _fail_reserved_request(
            session,
            request_id=request_id,
            failure_code=error.code,
            usage=_failure_usage(
                settings,
                latency_ms=latency_ms,
                safety_label=decision.label,
                provider_called=True,
            ),
            now=now,
        )
        raise error from None
    except (AiProviderUnavailable, AiProviderInvalidResponse):
        latency_ms = _latency_ms(started_at, monotonic)
        error = AppError(
            code="AI_PROVIDER_UNAVAILABLE",
            message="AI 服务暂不可用，请稍后重试",
            status_code=503,
        )
        _fail_reserved_request(
            session,
            request_id=request_id,
            failure_code=error.code,
            usage=_failure_usage(
                settings,
                latency_ms=latency_ms,
                safety_label=decision.label,
                provider_called=True,
            ),
            now=now,
        )
        raise error from None
    except Exception:
        latency_ms = _latency_ms(started_at, monotonic)
        _fail_reserved_request(
            session,
            request_id=request_id,
            failure_code="AI_INTERNAL_ERROR",
            usage=_failure_usage(
                settings,
                latency_ms=latency_ms,
                safety_label=decision.label,
                provider_called=True,
            ),
            now=now,
        )
        raise


def _review_generated_output(
    session: Session,
    *,
    request_id: UUID,
    generation_request: AiGenerationRequest,
    generated: AiGenerationResult,
    decision: SafetyDecision,
    settings: Settings,
    latency_ms: int,
    now: datetime,
) -> AiGenerationResult:
    allowed_recipe_ids = [
        recipe.id for recipe in generation_request.candidate_recipes
    ]
    try:
        return review_output(generated, decision, allowed_recipe_ids)
    except Exception:
        _fail_reserved_request(
            session,
            request_id=request_id,
            failure_code="AI_INTERNAL_ERROR",
            usage=_failure_usage(
                settings,
                latency_ms=latency_ms,
                safety_label=decision.label,
                provider_called=decision.fixed_reply is None,
            ),
            now=now,
        )
        raise


def _normal_response(
    exchange: SavedExchange,
    snapshot: QuotaSnapshot,
    memory_changes: list[MemoryChange],
) -> SendMessageResponse:
    return SendMessageResponse(
        conversation=conversation_response(exchange.conversation),
        user_message=message_response(exchange.user_message),
        assistant_message=message_response(exchange.assistant_message),
        usage=_usage_response(snapshot),
        memory_changes=memory_changes,
    )


def send_normal_message(
    session: Session,
    user: User,
    conversation_id: UUID,
    payload: SendMessageRequest,
    provider: AiProvider,
    settings: Settings,
    now: datetime,
    *,
    monotonic: Callable[[], float] = time.monotonic,
) -> SendMessageResponse:
    now = _utc_now(now)
    user_id = _identity_uuid(user)
    _prepare_session(session)
    request_id, disposition = _reserve_normal(
        session,
        user_id=user_id,
        conversation_id=conversation_id,
        payload=payload,
        settings=settings,
        now=now,
    )
    if disposition is ReservationDisposition.REPLAY:
        return _load_normal_replay(
            session,
            user_id=user_id,
            conversation_id=conversation_id,
            request_id=request_id,
            settings=settings,
            now=now,
        )
    if disposition is not ReservationDisposition.NEW:
        raise _reservation_error(disposition)

    try:
        decision, generation_request = _normal_context(
            session,
            user_id=user_id,
            conversation_id=conversation_id,
            content=payload.content,
            settings=settings,
        )
    except Exception:
        _fail_reserved_request(
            session,
            request_id=request_id,
            failure_code="AI_INTERNAL_ERROR",
            usage=_failure_usage(
                settings,
                latency_ms=0,
                safety_label=None,
                provider_called=False,
            ),
            now=now,
        )
        raise

    generated, latency_ms = _generate_output(
        session,
        request_id=request_id,
        generation_request=generation_request,
        decision=decision,
        provider=provider,
        settings=settings,
        now=now,
        monotonic=monotonic,
    )

    reviewed = _review_generated_output(
        session,
        request_id=request_id,
        generation_request=generation_request,
        generated=generated,
        decision=decision,
        settings=settings,
        latency_ms=latency_ms,
        now=now,
    )
    try:
        final_user = _trusted_user(session, user_id)
        exchange = save_exchange(
            session=session,
            user=final_user,
            conversation_id=conversation_id,
            request_id=request_id,
            user_content=payload.content,
            assistant_content=reviewed.reply_text,
            reviewed_recipe_ids=reviewed.recipe_ids,
            user_safety_label=decision.label,
            assistant_safety_label=reviewed.safety_label,
            now=now,
        )
        memory_changes = apply_memory_candidates(
            session,
            final_user,
            exchange.conversation,
            exchange.user_message,
            reviewed.memory_candidates,
            decision,
            AiChatMode.NORMAL,
            settings,
        )
        usage = (
            _server_safety_usage(
                decision,
                response_message_id=exchange.assistant_message.id,
            )
            if decision.fixed_reply is not None
            else _provider_usage(
                reviewed,
                latency_ms=latency_ms,
                response_message_id=exchange.assistant_message.id,
            )
        )
        snapshot = complete_reservation(
            session,
            _request_reference(session, request_id),
            usage,
            now,
        )
        response = _normal_response(exchange, snapshot, memory_changes)
        session.commit()
        return response
    except Exception:
        _rollback_if_active(session)
        _fail_reserved_request(
            session,
            request_id=request_id,
            failure_code="AI_INTERNAL_ERROR",
            usage=_failure_usage(
                settings,
                latency_ms=latency_ms,
                safety_label=reviewed.safety_label,
                provider_called=decision.fixed_reply is None,
            ),
            now=now,
        )
        raise


def send_temporary_message(
    session: Session,
    user: User,
    payload: TemporaryMessageRequest,
    provider: AiProvider,
    settings: Settings,
    now: datetime,
    *,
    monotonic: Callable[[], float] = time.monotonic,
) -> TemporaryMessageResponse:
    now = _utc_now(now)
    user_id = _identity_uuid(user)
    _prepare_session(session)
    request_id, disposition = _reserve_temporary(
        session,
        user_id=user_id,
        payload=payload,
        settings=settings,
        now=now,
    )
    if disposition is not ReservationDisposition.NEW:
        raise _reservation_error(disposition)

    try:
        decision, generation_request = _temporary_context(
            session,
            user_id=user_id,
            payload=payload,
            settings=settings,
        )
    except Exception:
        _fail_reserved_request(
            session,
            request_id=request_id,
            failure_code="AI_INTERNAL_ERROR",
            usage=_failure_usage(
                settings,
                latency_ms=0,
                safety_label=None,
                provider_called=False,
            ),
            now=now,
        )
        raise

    generated, latency_ms = _generate_output(
        session,
        request_id=request_id,
        generation_request=generation_request,
        decision=decision,
        provider=provider,
        settings=settings,
        now=now,
        monotonic=monotonic,
    )

    reviewed = _review_generated_output(
        session,
        request_id=request_id,
        generation_request=generation_request,
        generated=generated,
        decision=decision,
        settings=settings,
        latency_ms=latency_ms,
        now=now,
    )
    usage = (
        _server_safety_usage(decision)
        if decision.fixed_reply is not None
        else _provider_usage(reviewed, latency_ms=latency_ms)
    )
    response_message = AiMessageResponse(
        id=uuid.uuid4(),
        role=AiMessageRole.ASSISTANT,
        content=reviewed.reply_text,
        recipe_ids=reviewed.recipe_ids,
        safety_label=reviewed.safety_label,
        created_at=now,
    )
    try:
        snapshot = complete_reservation(
            session,
            _request_reference(session, request_id),
            usage,
            now,
        )
        response = TemporaryMessageResponse(
            assistant_message=response_message,
            usage=_usage_response(snapshot),
            memory_changes=[],
        )
        session.commit()
        return response
    except Exception:
        _rollback_if_active(session)
        _fail_reserved_request(
            session,
            request_id=request_id,
            failure_code="AI_INTERNAL_ERROR",
            usage=_failure_usage(
                settings,
                latency_ms=latency_ms,
                safety_label=reviewed.safety_label,
                provider_called=decision.fixed_reply is None,
            ),
            now=now,
        )
        raise
