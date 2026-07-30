from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from math import ceil
from typing import Any, cast
from uuid import UUID

from sqlalchemy import ColumnElement, delete, exists, func
from sqlmodel import Session, select

from app.core.errors import AppError
from app.db.models import (
    AiChatMode,
    AiConversation,
    AiMessage,
    AiMessageRole,
    AiRequest,
    AiRequestStatus,
    AiSafetyLabel,
    AiUsageLog,
    User,
)
from app.modules.ai.context import derive_conversation_title
from app.modules.ai.memory import (
    _remove_conversation_memory_sources_for_locked_conversations,
)
from app.modules.ai.schemas import (
    AiMessageResponse,
    ConversationListResponse,
    ConversationPaginationResponse,
    ConversationResponse,
    MessageListResponse,
    MessagePaginationResponse,
)

CONVERSATION_MAX_PAGE_SIZE = 50
MESSAGE_MAX_PAGE_SIZE = 100
STALE_EMPTY_CONVERSATION_AGE = timedelta(hours=24)
STALE_EMPTY_CLEANUP_BATCH_SIZE = 100


@dataclass(frozen=True)
class SavedExchange:
    conversation: AiConversation
    user_message: AiMessage
    assistant_message: AiMessage


def _column(value: Any) -> ColumnElement[Any]:
    return cast(ColumnElement[Any], value)


def _utc_now(now: datetime) -> datetime:
    if now.tzinfo is None:
        raise ValueError("now must be timezone-aware")
    return now.astimezone(UTC)


def _not_found() -> AppError:
    return AppError(
        code="AI_CONVERSATION_NOT_FOUND",
        message="AI 对话不存在",
        status_code=404,
    )


def _validate_page(*, page: int, page_size: int, maximum: int, resource: str) -> None:
    if page < 1:
        raise ValueError("page must be at least 1")
    if not 1 <= page_size <= maximum:
        raise ValueError(f"{resource} page_size must be between 1 and {maximum}")


def _conversation_pagination(
    *, page: int, page_size: int, total_items: int
) -> ConversationPaginationResponse:
    return ConversationPaginationResponse(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=ceil(total_items / page_size) if total_items else 0,
    )


def _message_pagination(
    *, page: int, page_size: int, total_items: int
) -> MessagePaginationResponse:
    return MessagePaginationResponse(
        page=page,
        page_size=page_size,
        total_items=total_items,
        total_pages=ceil(total_items / page_size) if total_items else 0,
    )


def conversation_response(conversation: AiConversation) -> ConversationResponse:
    return ConversationResponse(
        id=conversation.id,
        title=conversation.title,
        last_message_at=conversation.last_message_at,
        created_at=conversation.created_at,
    )


def message_response(message: AiMessage) -> AiMessageResponse:
    return AiMessageResponse(
        id=message.id,
        role=message.role,
        content=message.content,
        recipe_ids=message.recipe_ids,
        safety_label=message.safety_label,
        created_at=message.created_at,
    )


def _lock_user(session: Session, *, user_id: UUID) -> User:
    user = session.exec(
        select(User)
        .where(User.id == user_id)
        .execution_options(populate_existing=True)
        .with_for_update()
    ).first()
    if user is None:
        raise _not_found()
    return user


def get_owned_conversation(
    *, session: Session, user: User, conversation_id: UUID
) -> AiConversation:
    """Return a conversation only when its id and owner id match."""
    conversation = session.exec(
        select(AiConversation).where(
            AiConversation.id == conversation_id,
            AiConversation.user_id == user.id,
        )
    ).first()
    if conversation is None:
        raise _not_found()
    return conversation


def _lock_owned_conversation(
    *, session: Session, user_id: UUID, conversation_id: UUID
) -> tuple[User, AiConversation]:
    locked_user = _lock_user(session, user_id=user_id)
    conversation = session.exec(
        select(AiConversation)
        .where(
            AiConversation.id == conversation_id,
            AiConversation.user_id == locked_user.id,
        )
        .execution_options(populate_existing=True)
        .with_for_update()
    ).first()
    if conversation is None:
        raise _not_found()
    return locked_user, conversation


def _cleanup_candidates(
    *, session: Session, user_id: UUID, now: datetime, limit: int
) -> list[AiConversation]:
    cutoff = now - STALE_EMPTY_CONVERSATION_AGE
    message_exists = exists(
        select(AiMessage.id).where(
            AiMessage.conversation_id == AiConversation.id,
            AiMessage.user_id == user_id,
        )
    )
    live_reservation_exists = exists(
        select(AiRequest.id).where(
            AiRequest.conversation_id == AiConversation.id,
            AiRequest.user_id == user_id,
            AiRequest.status == AiRequestStatus.RESERVED,
            _column(AiRequest.reservation_expires_at).is_not(None),
            _column(AiRequest.reservation_expires_at) > now,
        )
    )
    return list(
        session.exec(
            select(AiConversation)
            .where(
                AiConversation.user_id == user_id,
                _column(AiConversation.created_at) < cutoff,
                ~message_exists,
                ~live_reservation_exists,
            )
            .order_by(_column(AiConversation.id).asc())
            .limit(limit)
            .with_for_update(skip_locked=True)
        ).all()
    )


def _owned_message_ids(
    *, session: Session, user_id: UUID, conversation_ids: list[UUID]
) -> set[UUID]:
    if not conversation_ids:
        return set()
    return set(
        session.exec(
            select(AiMessage.id).where(
                AiMessage.user_id == user_id,
                _column(AiMessage.conversation_id).in_(conversation_ids),
            )
        ).all()
    )


def _cascade_affected_instances(
    *, session: Session, conversation_ids: set[UUID], message_ids: set[UUID]
) -> tuple[list[AiConversation], list[AiMessage], list[AiRequest], list[AiUsageLog]]:
    conversations: list[AiConversation] = []
    messages: list[AiMessage] = []
    requests: list[AiRequest] = []
    usages: list[AiUsageLog] = []
    for instance in list(session.identity_map.values()):
        if isinstance(instance, AiConversation) and instance.id in conversation_ids:
            conversations.append(instance)
        elif isinstance(instance, AiMessage) and instance.id in message_ids:
            messages.append(instance)
        elif isinstance(instance, AiRequest) and (
            instance.conversation_id in conversation_ids
            or instance.response_message_id in message_ids
        ):
            requests.append(instance)
        elif isinstance(instance, AiUsageLog) and instance.conversation_id in conversation_ids:
            usages.append(instance)
    return conversations, messages, requests, usages


def _expire_database_cascade_state(
    *,
    session: Session,
    affected_instances: tuple[
        list[AiConversation], list[AiMessage], list[AiRequest], list[AiUsageLog]
    ],
) -> None:
    conversations, messages, requests, usages = affected_instances
    for conversation in conversations:
        session.expire(conversation)
    for message in messages:
        session.expire(message)
    for request in requests:
        session.expire(request, ["conversation_id", "response_message_id"])
    for usage in usages:
        session.expire(usage, ["conversation_id"])


def _hard_delete_locked_conversations(
    *, session: Session, user_id: UUID, conversation_ids: list[UUID]
) -> None:
    if not conversation_ids:
        return
    message_ids = _owned_message_ids(
        session=session,
        user_id=user_id,
        conversation_ids=conversation_ids,
    )
    affected_instances = _cascade_affected_instances(
        session=session,
        conversation_ids=set(conversation_ids),
        message_ids=message_ids,
    )
    session.exec(
        delete(AiConversation)
        .where(
            _column(AiConversation.user_id) == user_id,
            _column(AiConversation.id).in_(conversation_ids),
        )
        .execution_options(synchronize_session=False)
    )
    session.flush()
    _expire_database_cascade_state(
        session=session,
        affected_instances=affected_instances,
    )


def cleanup_stale_empty_conversations(
    *,
    session: Session,
    user: User,
    now: datetime,
    limit: int = STALE_EMPTY_CLEANUP_BATCH_SIZE,
) -> int:
    """Prune only one user's stale, message-free conversations without commit."""
    now = _utc_now(now)
    if limit < 1:
        raise ValueError("limit must be at least 1")
    locked_user = _lock_user(session, user_id=user.id)
    candidates = _cleanup_candidates(
        session=session, user_id=locked_user.id, now=now, limit=limit
    )
    candidate_ids = [conversation.id for conversation in candidates]
    _remove_conversation_memory_sources_for_locked_conversations(
        session,
        user_id=locked_user.id,
        conversation_ids=candidate_ids,
    )
    if candidates:
        _hard_delete_locked_conversations(
            session=session,
            user_id=locked_user.id,
            conversation_ids=candidate_ids,
        )
    return len(candidates)


def create_conversation(
    *, session: Session, user: User, now: datetime
) -> ConversationResponse:
    """Create an empty, caller-owned conversation after bounded stale cleanup."""
    now = _utc_now(now)
    cleanup_stale_empty_conversations(session=session, user=user, now=now)
    conversation = AiConversation(
        user_id=user.id,
        created_at=now,
        updated_at=now,
    )
    session.add(conversation)
    session.flush()
    return conversation_response(conversation)


def list_conversations(
    *, session: Session, user: User, page: int, page_size: int, now: datetime
) -> ConversationListResponse:
    """List only conversations with a completed exchange in stable newest-first order."""
    _validate_page(
        page=page,
        page_size=page_size,
        maximum=CONVERSATION_MAX_PAGE_SIZE,
        resource="conversation",
    )
    cleanup_stale_empty_conversations(session=session, user=user, now=now)
    last_message_at = _column(AiConversation.last_message_at)
    conversation_id = _column(AiConversation.id)
    statement = select(AiConversation).where(
        AiConversation.user_id == user.id,
        last_message_at.is_not(None),
    )
    total_items = session.exec(select(func.count()).select_from(statement.subquery())).one()
    conversations = session.exec(
        statement.order_by(last_message_at.desc(), conversation_id.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return ConversationListResponse(
        items=[conversation_response(conversation) for conversation in conversations],
        pagination=_conversation_pagination(
            page=page, page_size=page_size, total_items=total_items
        ),
    )


def list_messages(
    *,
    session: Session,
    user: User,
    conversation_id: UUID,
    page: int,
    page_size: int,
) -> MessageListResponse:
    """List an owned conversation's messages in stable chronological order."""
    _validate_page(
        page=page,
        page_size=page_size,
        maximum=MESSAGE_MAX_PAGE_SIZE,
        resource="message",
    )
    get_owned_conversation(session=session, user=user, conversation_id=conversation_id)
    created_at = _column(AiMessage.created_at)
    message_id = _column(AiMessage.id)
    statement = select(AiMessage).where(
        AiMessage.conversation_id == conversation_id,
        AiMessage.user_id == user.id,
    )
    total_items = session.exec(select(func.count()).select_from(statement.subquery())).one()
    messages = session.exec(
        statement.order_by(created_at.asc(), message_id.asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return MessageListResponse(
        items=[message_response(message) for message in messages],
        pagination=_message_pagination(
            page=page, page_size=page_size, total_items=total_items
        ),
    )


def _request_for_exchange(
    *,
    session: Session,
    user_id: UUID,
    conversation_id: UUID,
    request_id: UUID,
) -> AiRequest:
    request = session.exec(
        select(AiRequest)
        .where(
            AiRequest.id == request_id,
            AiRequest.user_id == user_id,
            AiRequest.conversation_id == conversation_id,
            AiRequest.mode == AiChatMode.NORMAL,
        )
        .execution_options(populate_existing=True)
        .with_for_update()
    ).first()
    if request is None:
        raise AppError(code="AI_REQUEST_NOT_FOUND", message="AI 请求不存在", status_code=404)
    return request


def _replayed_exchange(
    *, session: Session, request: AiRequest, conversation: AiConversation
) -> SavedExchange | None:
    if request.response_message_id is None:
        return None
    assistant_message = session.exec(
        select(AiMessage).where(
            AiMessage.id == request.response_message_id,
            AiMessage.user_id == request.user_id,
            AiMessage.conversation_id == conversation.id,
            AiMessage.role == AiMessageRole.ASSISTANT,
        )
    ).first()
    if assistant_message is None:
        raise AppError(
            code="AI_REQUEST_RESPONSE_INVALID",
            message="AI 回复状态无效",
            status_code=409,
        )
    user_message = session.exec(
        select(AiMessage)
        .where(
            AiMessage.user_id == request.user_id,
            AiMessage.conversation_id == conversation.id,
            AiMessage.role == AiMessageRole.USER,
            _column(AiMessage.created_at) < assistant_message.created_at,
        )
        .order_by(_column(AiMessage.created_at).desc(), _column(AiMessage.id).desc())
        .limit(1)
    ).first()
    if user_message is None:
        raise AppError(
            code="AI_REQUEST_RESPONSE_INVALID",
            message="AI 回复状态无效",
            status_code=409,
        )
    return SavedExchange(
        conversation=conversation,
        user_message=user_message,
        assistant_message=assistant_message,
    )


def _validate_content(*, content: str, limit: int, field: str) -> None:
    if not content.strip() or len(content) > limit:
        raise ValueError(f"{field} must be between 1 and {limit} characters")


def _next_exchange_timestamps(
    *, session: Session, conversation: AiConversation, now: datetime
) -> tuple[datetime, datetime]:
    latest = session.exec(
        select(AiMessage)
        .where(
            AiMessage.conversation_id == conversation.id,
            AiMessage.user_id == conversation.user_id,
        )
        .order_by(_column(AiMessage.created_at).desc(), _column(AiMessage.id).desc())
        .limit(1)
    ).first()
    user_created_at = now
    if latest is not None and latest.created_at >= user_created_at:
        user_created_at = latest.created_at + timedelta(microseconds=1)
    return user_created_at, user_created_at + timedelta(microseconds=1)


def save_exchange(
    *,
    session: Session,
    user: User,
    conversation_id: UUID,
    request_id: UUID,
    user_content: str,
    assistant_content: str,
    reviewed_recipe_ids: list[UUID],
    user_safety_label: AiSafetyLabel,
    assistant_safety_label: AiSafetyLabel,
    now: datetime,
) -> SavedExchange:
    """Write a normal exchange and its idempotency anchor without committing."""
    _validate_content(content=user_content, limit=2_000, field="user_content")
    _validate_content(content=assistant_content, limit=8_000, field="assistant_content")
    now = _utc_now(now)
    locked_user, conversation = _lock_owned_conversation(
        session=session, user_id=user.id, conversation_id=conversation_id
    )
    request = _request_for_exchange(
        session=session,
        user_id=locked_user.id,
        conversation_id=conversation.id,
        request_id=request_id,
    )
    replay = _replayed_exchange(session=session, request=request, conversation=conversation)
    if replay is not None:
        return replay
    if request.status is not AiRequestStatus.RESERVED:
        raise AppError(
            code="AI_REQUEST_NOT_ACTIVE",
            message="AI 请求不在可完成状态",
            status_code=409,
        )
    user_created_at, assistant_created_at = _next_exchange_timestamps(
        session=session, conversation=conversation, now=now
    )
    user_message = AiMessage(
        conversation_id=conversation.id,
        user_id=locked_user.id,
        role=AiMessageRole.USER,
        content=user_content,
        safety_label=user_safety_label,
        created_at=user_created_at,
    )
    assistant_message = AiMessage(
        conversation_id=conversation.id,
        user_id=locked_user.id,
        role=AiMessageRole.ASSISTANT,
        content=assistant_content,
        recipe_ids=list(dict.fromkeys(reviewed_recipe_ids)),
        safety_label=assistant_safety_label,
        created_at=assistant_created_at,
    )
    session.add_all([user_message, assistant_message])
    if conversation.last_message_at is None:
        conversation.title = derive_conversation_title(user_content)
    conversation.last_message_at = assistant_created_at
    conversation.updated_at = assistant_created_at
    request.response_message_id = assistant_message.id
    session.add_all([conversation, request])
    session.flush()
    return SavedExchange(
        conversation=conversation,
        user_message=user_message,
        assistant_message=assistant_message,
    )


def delete_conversation(
    *, session: Session, user: User, conversation_id: UUID
) -> None:
    """Hard-delete an owned conversation and prune only its orphaned memories."""
    _, conversation = _lock_owned_conversation(
        session=session, user_id=user.id, conversation_id=conversation_id
    )
    _remove_conversation_memory_sources_for_locked_conversations(
        session,
        user_id=conversation.user_id,
        conversation_ids=[conversation.id],
    )
    _hard_delete_locked_conversations(
        session=session,
        user_id=conversation.user_id,
        conversation_ids=[conversation.id],
    )
