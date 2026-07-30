from datetime import UTC, datetime
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.db.models import AiMessageRole, AiSafetyLabel
from app.modules.ai.schemas import (
    AiMessageResponse,
    ConversationListResponse,
    ConversationPaginationResponse,
    ConversationResponse,
    MessageListResponse,
    MessagePaginationResponse,
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
    conversation_pagination = ConversationPaginationResponse(
        page=1, page_size=50, total_items=1, total_pages=1
    )
    message_pagination = MessagePaginationResponse(
        page=1, page_size=50, total_items=1, total_pages=1
    )

    assert ConversationListResponse(
        items=[conversation], pagination=conversation_pagination
    ).model_dump(
        by_alias=True, mode="json"
    )["items"][0] == {
        "id": str(conversation.id),
        "title": "新的对话",
        "lastMessageAt": None,
        "createdAt": "2026-07-29T12:00:00Z",
    }
    assert MessageListResponse(items=[message], pagination=message_pagination).model_dump(
        by_alias=True, mode="json"
    )["items"][0]["safetyLabel"] == "SAFE"


def test_pagination_contracts_enforce_resource_specific_page_sizes() -> None:
    with pytest.raises(ValidationError):
        ConversationPaginationResponse(page=1, page_size=51, total_items=0, total_pages=0)

    assert MessagePaginationResponse(
        page=1, page_size=51, total_items=0, total_pages=0
    ).page_size == 51
    assert MessagePaginationResponse(
        page=1, page_size=100, total_items=0, total_pages=0
    ).page_size == 100
    with pytest.raises(ValidationError):
        MessagePaginationResponse(page=1, page_size=101, total_items=0, total_pages=0)
