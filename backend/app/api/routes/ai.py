from typing import Annotated, Any
from uuid import UUID

from fastapi import APIRouter, Depends, Path, Query, Response, status
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.core.errors import ErrorEnvelope
from app.db.models.accounts import utc_now
from app.db.session import get_session
from app.integrations.ai import AiProvider, get_ai_provider_dependency
from app.modules.ai.access import require_ai_access
from app.modules.ai.conversations import (
    CONVERSATION_MAX_PAGE_SIZE,
    MESSAGE_MAX_PAGE_SIZE,
    conversation_response,
    create_conversation,
    delete_conversation,
    get_owned_conversation,
    list_conversations,
    list_messages,
)
from app.modules.ai.memory import (
    clear_memories,
    delete_memory,
    list_memories,
    set_memory_enabled,
)
from app.modules.ai.orchestrator import send_normal_message, send_temporary_message
from app.modules.ai.quota import QuotaSnapshot, quota_snapshot
from app.modules.ai.schemas import (
    AiUsageResponse,
    ConversationListResponse,
    ConversationResponse,
    MemoryListResponse,
    MemorySettingsRequest,
    MemorySettingsResponse,
    MessageListResponse,
    SendMessageRequest,
    SendMessageResponse,
    TemporaryMessageRequest,
    TemporaryMessageResponse,
)
from app.modules.auth.dependencies import CurrentAuth

router = APIRouter(prefix="/ai", tags=["ai"])
SessionDep = Annotated[Session, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
AiProviderDep = Annotated[AiProvider, Depends(get_ai_provider_dependency)]
ConversationId = Annotated[UUID, Path(alias="conversationId")]
MemoryId = Annotated[UUID, Path(alias="memoryId")]
Page = Annotated[int, Query(ge=1)]
ConversationPageSize = Annotated[
    int,
    Query(alias="pageSize", ge=1, le=CONVERSATION_MAX_PAGE_SIZE),
]
MessagePageSize = Annotated[
    int,
    Query(alias="pageSize", ge=1, le=MESSAGE_MAX_PAGE_SIZE),
]

AI_ERROR_RESPONSES: dict[int | str, dict[str, Any]] = {
    401: {"model": ErrorEnvelope},
    403: {"model": ErrorEnvelope},
    404: {"model": ErrorEnvelope},
    409: {"model": ErrorEnvelope},
    422: {"model": ErrorEnvelope},
    429: {"model": ErrorEnvelope},
    503: {"model": ErrorEnvelope},
    504: {"model": ErrorEnvelope},
}


def _mark_non_persistent(response: Response) -> None:
    response.headers["Cache-Control"] = "no-store"
    response.headers["Pragma"] = "no-cache"


def _usage_response(snapshot: QuotaSnapshot) -> AiUsageResponse:
    return AiUsageResponse(
        limit=snapshot.daily_message_limit,
        used=snapshot.messages_used_today,
        remaining=snapshot.remaining,
        resets_at=snapshot.resets_at,
    )


def _require_ai_access(auth: CurrentAuth, settings: Settings) -> None:
    require_ai_access(auth.user, settings)


@router.get(
    "/conversations",
    response_model=ConversationListResponse,
    responses=AI_ERROR_RESPONSES,
)
def get_conversations(
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
    page: Page = 1,
    page_size: ConversationPageSize = 20,
) -> ConversationListResponse:
    _require_ai_access(auth, settings)
    return list_conversations(
        session=session,
        user=auth.user,
        page=page,
        page_size=page_size,
        now=utc_now(),
    )


@router.post(
    "/conversations",
    response_model=ConversationResponse,
    status_code=status.HTTP_201_CREATED,
    responses=AI_ERROR_RESPONSES,
)
def post_conversation(
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
) -> ConversationResponse:
    _require_ai_access(auth, settings)
    response = create_conversation(session=session, user=auth.user, now=utc_now())
    session.commit()
    return response


@router.get(
    "/conversations/{conversationId}",
    response_model=ConversationResponse,
    responses=AI_ERROR_RESPONSES,
)
def get_conversation(
    conversation_id: ConversationId,
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
) -> ConversationResponse:
    _require_ai_access(auth, settings)
    conversation = get_owned_conversation(
        session=session,
        user=auth.user,
        conversation_id=conversation_id,
    )
    return conversation_response(conversation)


@router.delete(
    "/conversations/{conversationId}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=AI_ERROR_RESPONSES,
)
def remove_conversation(
    conversation_id: ConversationId,
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
) -> Response:
    _require_ai_access(auth, settings)
    delete_conversation(
        session=session,
        user=auth.user,
        conversation_id=conversation_id,
    )
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/conversations/{conversationId}/messages",
    response_model=MessageListResponse,
    responses=AI_ERROR_RESPONSES,
)
def get_messages(
    conversation_id: ConversationId,
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
    page: Page = 1,
    page_size: MessagePageSize = 50,
) -> MessageListResponse:
    _require_ai_access(auth, settings)
    return list_messages(
        session=session,
        user=auth.user,
        conversation_id=conversation_id,
        page=page,
        page_size=page_size,
    )


@router.post(
    "/conversations/{conversationId}/messages",
    response_model=SendMessageResponse,
    responses=AI_ERROR_RESPONSES,
)
def post_message(
    conversation_id: ConversationId,
    payload: SendMessageRequest,
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
    provider: AiProviderDep,
) -> SendMessageResponse:
    return send_normal_message(
        session,
        auth.user,
        conversation_id,
        payload,
        provider,
        settings,
        utc_now(),
    )


@router.post(
    "/temporary-messages",
    response_model=TemporaryMessageResponse,
    responses=AI_ERROR_RESPONSES,
)
def post_temporary_message(
    payload: TemporaryMessageRequest,
    response: Response,
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
    provider: AiProviderDep,
) -> TemporaryMessageResponse:
    _mark_non_persistent(response)
    return send_temporary_message(
        session,
        auth.user,
        payload,
        provider,
        settings,
        utc_now(),
    )


@router.get(
    "/memories",
    response_model=MemoryListResponse,
    responses=AI_ERROR_RESPONSES,
)
def get_memories(
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
) -> MemoryListResponse:
    _require_ai_access(auth, settings)
    return MemoryListResponse(items=list_memories(session, auth.user, settings))


@router.delete(
    "/memories/{memoryId}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=AI_ERROR_RESPONSES,
)
def remove_memory(
    memory_id: MemoryId,
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
) -> Response:
    _require_ai_access(auth, settings)
    delete_memory(session, auth.user, memory_id, settings)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete(
    "/memories",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=AI_ERROR_RESPONSES,
)
def remove_memories(
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
) -> Response:
    _require_ai_access(auth, settings)
    clear_memories(session, auth.user, settings)
    session.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch(
    "/memory-settings",
    response_model=MemorySettingsResponse,
    responses=AI_ERROR_RESPONSES,
)
def patch_memory_settings(
    payload: MemorySettingsRequest,
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
) -> MemorySettingsResponse:
    _require_ai_access(auth, settings)
    user = set_memory_enabled(session, auth.user, payload.enabled)
    session.commit()
    return MemorySettingsResponse(enabled=user.memory_enabled)


@router.get(
    "/usage/today",
    response_model=AiUsageResponse,
    responses=AI_ERROR_RESPONSES,
)
def get_usage_today(
    session: SessionDep,
    auth: CurrentAuth,
    settings: SettingsDep,
) -> AiUsageResponse:
    _require_ai_access(auth, settings)
    return _usage_response(quota_snapshot(session, auth.user.id, settings, utc_now()))
