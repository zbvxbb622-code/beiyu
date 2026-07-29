from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from pydantic import ValidationError

from app.db.models import AiMemoryCategory, AiMessageRole, AiSafetyLabel
from app.modules.ai.schemas import (
    AiGenerationMessage,
    AiMemoryResponse,
    AiMessageResponse,
    AiUsageResponse,
    ConversationResponse,
    MemoryChange,
    MemoryChangeAction,
    PaginationResponse,
    SendMessageRequest,
    SendMessageResponse,
    TemporaryContextMessage,
    TemporaryMessageRequest,
)


def test_normal_message_contract_trims_content_and_serializes_design_example_in_camel_case() -> None:
    client_message_id = uuid4()
    request = SendMessageRequest(content="  我喜欢清爽、低甜的味道。  ", client_message_id=client_message_id)
    timestamp = datetime(2026, 7, 29, 8, 30, tzinfo=UTC)
    conversation = ConversationResponse(
        id=uuid4(),
        title="我喜欢清爽低甜",
        last_message_at=timestamp,
        created_at=timestamp,
    )
    user_message = AiMessageResponse(
        id=uuid4(),
        role=AiMessageRole.USER,
        content=request.content,
        recipe_ids=[],
        safety_label=AiSafetyLabel.SAFE,
        created_at=timestamp,
    )
    response = SendMessageResponse(
        conversation=conversation,
        user_message=user_message,
        assistant_message=AiMessageResponse(
            id=uuid4(),
            role=AiMessageRole.ASSISTANT,
            content="记下了。",
            recipe_ids=[],
            safety_label=AiSafetyLabel.SAFE,
            created_at=timestamp,
        ),
        usage=AiUsageResponse(limit=50, used=1, remaining=49, resets_at=timestamp),
        memory_changes=[
            MemoryChange(
                id=uuid4(),
                action=MemoryChangeAction.CREATED,
                category=AiMemoryCategory.DRINK_PREFERENCE,
                summary="偏好清爽、低甜的饮品",
            )
        ],
    )

    assert request.content == "我喜欢清爽、低甜的味道。"
    assert request.model_dump() == {
        "content": "我喜欢清爽、低甜的味道。",
        "clientMessageId": client_message_id,
    }
    assert response.model_dump()["assistantMessage"]["recipeIds"] == []
    assert response.model_dump()["usage"] == {
        "limit": 50,
        "used": 1,
        "remaining": 49,
        "resetsAt": timestamp,
    }
    assert response.model_dump()["memoryChanges"][0]["action"] == "CREATED"


@pytest.mark.parametrize("content", ["   ", "x" * 2001])
def test_message_content_must_be_non_blank_after_trim_and_at_most_2000_characters(
    content: str,
) -> None:
    with pytest.raises(ValidationError):
        SendMessageRequest(content=content, client_message_id=uuid4())


def test_message_length_is_checked_after_trim() -> None:
    request = SendMessageRequest(content=" " + "x" * 2_000, client_message_id=uuid4())

    assert request.content == "x" * 2_000


def test_temporary_context_enforces_message_and_role_content_character_budgets() -> None:
    context = [
        TemporaryContextMessage(role=AiMessageRole.USER, content="x" * 2_000)
        for _ in range(6)
    ]

    with pytest.raises(ValidationError):
        TemporaryMessageRequest(
            content="现在想继续聊聊",
            client_message_id=uuid4(),
            context=context,
        )

    with pytest.raises(ValidationError):
        TemporaryMessageRequest(
            content="现在想继续聊聊",
            client_message_id=uuid4(),
            context=[TemporaryContextMessage(role=AiMessageRole.USER, content="x")]
            * 21,
        )


def test_contracts_reject_invalid_uuids_and_keep_existing_api_extra_policy() -> None:
    with pytest.raises(ValidationError):
        SendMessageRequest(content="你好", client_message_id="not-a-uuid")

    item = AiMemoryResponse.model_validate(
        {
            "id": str(uuid4()),
            "category": "EMOTIONAL_PREFERENCE",
            "summary": "希望先被倾听",
            "createdAt": "2026-07-29T08:30:00Z",
            "unknownFutureField": "ignored like the existing API models",
        }
    )
    page = PaginationResponse(page=1, page_size=20, total_items=1, total_pages=1)

    assert isinstance(item.id, UUID)
    assert item.model_extra is None
    assert page.model_dump() == {
        "page": 1,
        "pageSize": 20,
        "totalItems": 1,
        "totalPages": 1,
    }


def test_generation_messages_apply_role_aware_persisted_message_limits() -> None:
    assistant = AiGenerationMessage(role="assistant", content="a" * 8_000)

    assert assistant.content == "a" * 8_000
    with pytest.raises(ValidationError):
        AiGenerationMessage(role="assistant", content="a" * 8_001)
    with pytest.raises(ValidationError):
        AiGenerationMessage(role="user", content="u" * 2_001)
