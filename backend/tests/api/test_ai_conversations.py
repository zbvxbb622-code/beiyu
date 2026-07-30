from datetime import UTC, datetime
from uuid import uuid4

from app.db.models import AiMessageRole, AiSafetyLabel
from app.modules.ai.schemas import (
    AiMessageResponse,
    ConversationListResponse,
    ConversationResponse,
    MessageListResponse,
    PaginationResponse,
)


def test_conversation_contract_uses_existing_camel_case_schema_without_routes() -> None:
    timestamp = datetime(2026, 7, 29, 12, tzinfo=UTC)
    conversation = ConversationResponse(
        id=uuid4(),
        title="新的对话",
        last_message_at=None,
        created_at=timestamp,
    )
    message = AiMessageResponse(
        id=uuid4(),
        role=AiMessageRole.ASSISTANT,
        content="已记录。",
        recipe_ids=[],
        safety_label=AiSafetyLabel.SAFE,
        created_at=timestamp,
    )
    pagination = PaginationResponse(
        page=1, page_size=50, total_items=1, total_pages=1
    )

    assert ConversationListResponse(items=[conversation], pagination=pagination).model_dump(
        by_alias=True, mode="json"
    )["items"][0] == {
        "id": str(conversation.id),
        "title": "新的对话",
        "lastMessageAt": None,
        "createdAt": "2026-07-29T12:00:00Z",
    }
    assert MessageListResponse(items=[message], pagination=pagination).model_dump(
        by_alias=True, mode="json"
    )["items"][0]["safetyLabel"] == "SAFE"
