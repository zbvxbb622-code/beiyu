from datetime import UTC, datetime
from uuid import uuid4

from fastapi import FastAPI
from starlette.testclient import TestClient

from app.core.errors import AppError, register_exception_handlers
from app.db.models import AiMessageRole, AiSafetyLabel
from app.modules.ai.schemas import (
    AiMessageResponse,
    AiUsageResponse,
    TemporaryMessageRequest,
    TemporaryMessageResponse,
)


def test_temporary_message_service_contract_has_no_retention_fields() -> None:
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    response_id = uuid4()
    app = FastAPI()
    register_exception_handlers(app)

    @app.post(
        "/api/v1/ai/temporary-messages",
        response_model=TemporaryMessageResponse,
    )
    def stub_temporary_service(
        payload: TemporaryMessageRequest,
    ) -> TemporaryMessageResponse:
        assert payload.context[0].content == "今天不太顺利。"
        return TemporaryMessageResponse(
            assistant_message=AiMessageResponse(
                id=response_id,
                role=AiMessageRole.ASSISTANT,
                content="我在。你可以慢慢说。",
                safety_label=AiSafetyLabel.SAFE,
                created_at=now,
            ),
            usage=AiUsageResponse(
                limit=50,
                used=2,
                remaining=48,
                resets_at=datetime(2026, 7, 29, 16, tzinfo=UTC),
            ),
        )

    with TestClient(app) as client:
        response = client.post(
            "/api/v1/ai/temporary-messages",
            json={
                "content": "继续刚才的话题。",
                "clientMessageId": str(uuid4()),
                "context": [{"role": "USER", "content": "今天不太顺利。"}],
            },
        )

    assert response.status_code == 200
    assert response.json() == {
        "assistantMessage": {
            "id": str(response_id),
            "role": "ASSISTANT",
            "content": "我在。你可以慢慢说。",
            "recipeIds": [],
            "safetyLabel": "SAFE",
            "createdAt": "2026-07-29T12:00:00Z",
        },
        "usage": {
            "limit": 50,
            "used": 2,
            "remaining": 48,
            "resetsAt": "2026-07-29T16:00:00Z",
        },
        "memoryChanges": [],
    }
    assert "conversation" not in response.json()
    assert "userMessage" not in response.json()


def test_temporary_lost_service_contract_is_a_stable_409() -> None:
    app = FastAPI()
    register_exception_handlers(app)

    @app.post("/api/v1/ai/temporary-messages")
    def stub_temporary_lost(_: TemporaryMessageRequest) -> None:
        raise AppError(
            code="TEMPORARY_RESPONSE_NOT_RETAINED",
            message="临时回复无法恢复",
            status_code=409,
        )

    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.post(
            "/api/v1/ai/temporary-messages",
            json={
                "content": "继续刚才的话题。",
                "clientMessageId": str(uuid4()),
                "context": [],
            },
        )

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "TEMPORARY_RESPONSE_NOT_RETAINED",
            "message": "临时回复无法恢复",
            "details": {},
        }
    }
