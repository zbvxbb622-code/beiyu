from datetime import UTC, datetime
from uuid import uuid4

from fastapi import FastAPI
from starlette.testclient import TestClient

from app.core.errors import register_exception_handlers
from app.db.models import AiMessageRole, AiSafetyLabel
from app.modules.ai.schemas import (
    AiMessageResponse,
    AiUsageResponse,
    ConversationResponse,
    SendMessageRequest,
    SendMessageResponse,
)


def test_normal_message_service_contract_serializes_for_task14_route() -> None:
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    conversation_id = uuid4()
    user_message_id = uuid4()
    assistant_message_id = uuid4()
    app = FastAPI()
    register_exception_handlers(app)

    @app.post(
        "/api/v1/ai/conversations/{conversation_id}/messages",
        response_model=SendMessageResponse,
    )
    def stub_message_service(
        conversation_id: str,
        payload: SendMessageRequest,
    ) -> SendMessageResponse:
        assert conversation_id
        return SendMessageResponse(
            conversation=ConversationResponse(
                id=conversation_id,
                title="我喜欢清爽低甜",
                last_message_at=now,
                created_at=now,
            ),
            user_message=AiMessageResponse(
                id=user_message_id,
                role=AiMessageRole.USER,
                content=payload.content,
                safety_label=AiSafetyLabel.SAFE,
                created_at=now,
            ),
            assistant_message=AiMessageResponse(
                id=assistant_message_id,
                role=AiMessageRole.ASSISTANT,
                content="记下了。",
                safety_label=AiSafetyLabel.SAFE,
                created_at=now,
            ),
            usage=AiUsageResponse(
                limit=50,
                used=1,
                remaining=49,
                resets_at=datetime(2026, 7, 29, 16, tzinfo=UTC),
            ),
        )

    with TestClient(app) as client:
        response = client.post(
            f"/api/v1/ai/conversations/{conversation_id}/messages",
            json={
                "content": "我喜欢清爽、低甜的饮品。",
                "clientMessageId": str(uuid4()),
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "conversation": {
            "id": str(conversation_id),
            "title": "我喜欢清爽低甜",
            "lastMessageAt": "2026-07-29T12:00:00Z",
            "createdAt": "2026-07-29T12:00:00Z",
        },
        "userMessage": {
            "id": str(user_message_id),
            "role": "USER",
            "content": "我喜欢清爽、低甜的饮品。",
            "recipeIds": [],
            "safetyLabel": "SAFE",
            "createdAt": "2026-07-29T12:00:00Z",
        },
        "assistantMessage": {
            "id": str(assistant_message_id),
            "role": "ASSISTANT",
            "content": "记下了。",
            "recipeIds": [],
            "safetyLabel": "SAFE",
            "createdAt": "2026-07-29T12:00:00Z",
        },
        "usage": {
            "limit": 50,
            "used": 1,
            "remaining": 49,
            "resetsAt": "2026-07-29T16:00:00Z",
        },
        "memoryChanges": [],
    }
