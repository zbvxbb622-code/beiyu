from datetime import UTC, datetime
from uuid import UUID, uuid4

from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.core.config import Settings, get_settings
from app.db.models import (
    AiChatMode,
    AiConversation,
    AiDailyQuota,
    AiMessage,
    AiRequest,
    AiUsageLog,
    User,
    UserStatus,
)
from app.main import app
from tests.api.test_auth_sessions import bearer, create_login


def _login_with_ai_access(
    client: TestClient,
    session: Session,
) -> tuple[dict[str, object], User]:
    login = create_login(client)
    user = session.exec(select(User)).one()
    user.age_confirmed_at = datetime(2026, 7, 29, 12, tzinfo=UTC)
    session.add(user)
    session.commit()
    return login, user


def _ai_headers(login: dict[str, object]) -> dict[str, str]:
    return bearer(login["accessToken"])


def test_ai_conversation_message_temporary_usage_and_delete_flow(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login, user = _login_with_ai_access(database_client, database_session)
    headers = _ai_headers(login)

    created = database_client.post("/api/v1/ai/conversations", headers=headers)
    assert created.status_code == 201, created.text
    conversation_id = created.json()["id"]
    assert created.json()["lastMessageAt"] is None

    empty_list = database_client.get("/api/v1/ai/conversations", headers=headers)
    assert empty_list.status_code == 200
    assert empty_list.json()["items"] == []

    sent = database_client.post(
        f"/api/v1/ai/conversations/{conversation_id}/messages",
        headers=headers,
        json={
            "content": "我喜欢清爽、低甜的饮品。",
            "clientMessageId": str(uuid4()),
        },
    )
    assert sent.status_code == 200, sent.text
    body = sent.json()
    assert body["conversation"]["id"] == conversation_id
    assert body["userMessage"]["content"] == "我喜欢清爽、低甜的饮品。"
    assert body["assistantMessage"]["content"]
    assert body["usage"]["used"] == 1
    assert body["usage"]["remaining"] == 49
    assert [change["summary"] for change in body["memoryChanges"]] == [
        "偏好清爽、低甜的饮品"
    ]

    detail = database_client.get(
        f"/api/v1/ai/conversations/{conversation_id}",
        headers=headers,
    )
    assert detail.status_code == 200
    assert detail.json()["id"] == conversation_id
    assert detail.json()["lastMessageAt"] is not None

    listed = database_client.get(
        "/api/v1/ai/conversations?page=1&pageSize=20",
        headers=headers,
    )
    assert [item["id"] for item in listed.json()["items"]] == [conversation_id]
    assert listed.json()["pagination"]["pageSize"] == 20

    messages = database_client.get(
        f"/api/v1/ai/conversations/{conversation_id}/messages?page=1&pageSize=50",
        headers=headers,
    )
    assert messages.status_code == 200
    assert [item["role"] for item in messages.json()["items"]] == [
        "USER",
        "ASSISTANT",
    ]
    assert messages.json()["pagination"]["pageSize"] == 50

    temporary = database_client.post(
        "/api/v1/ai/temporary-messages",
        headers=headers,
        json={
            "content": "继续刚才的话题。",
            "clientMessageId": str(uuid4()),
            "context": [{"role": "USER", "content": "今天不太顺利。"}],
        },
    )
    assert temporary.status_code == 200, temporary.text
    assert temporary.json()["assistantMessage"]["content"]
    assert temporary.json()["usage"]["used"] == 2
    assert temporary.json()["memoryChanges"] == []

    usage = database_client.get("/api/v1/ai/usage/today", headers=headers)
    assert usage.status_code == 200
    assert usage.json()["limit"] == 50
    assert usage.json()["used"] == 2
    assert usage.json()["remaining"] == 48

    assert database_session.exec(select(AiDailyQuota)).one().used_count == 2
    assert len(database_session.exec(select(AiUsageLog)).all()) == 2
    assert len(database_session.exec(select(AiMessage)).all()) == 2
    temporary_request = database_session.exec(
        select(AiRequest).where(AiRequest.mode == AiChatMode.TEMPORARY)
    ).one()
    assert temporary_request.conversation_id is None
    assert temporary_request.response_message_id is None

    deleted = database_client.delete(
        f"/api/v1/ai/conversations/{conversation_id}",
        headers=headers,
    )
    assert deleted.status_code == 204
    assert database_session.exec(select(AiMessage)).all() == []
    assert database_session.get(AiConversation, UUID(conversation_id)) is None
    assert database_session.exec(select(User).where(User.id == user.id)).one() is not None


def test_ai_access_requires_auth_age_active_account_and_feature_flag(
    database_client: TestClient,
    database_session: Session,
) -> None:
    missing = database_client.get("/api/v1/ai/usage/today")
    assert missing.status_code == 401
    assert missing.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"

    login = create_login(database_client)
    headers = _ai_headers(login)

    no_age = database_client.get("/api/v1/ai/usage/today", headers=headers)
    assert no_age.status_code == 403
    assert no_age.json()["error"]["code"] == "AGE_CONFIRMATION_REQUIRED"

    user = database_session.exec(select(User)).one()
    user.age_confirmed_at = datetime(2026, 7, 29, 12, tzinfo=UTC)
    user.status = UserStatus.BANNED
    database_session.add(user)
    database_session.commit()

    banned = database_client.get("/api/v1/ai/usage/today", headers=headers)
    assert banned.status_code == 403
    assert banned.json()["error"]["code"] == "AI_ACCESS_SUSPENDED"

    user.status = UserStatus.ACTIVE
    database_session.add(user)
    database_session.commit()

    def disabled_settings() -> Settings:
        return Settings(
            database_url="postgresql+psycopg://beiyu:beiyu@localhost:5433/beiyu_test",
            ai_enabled=False,
        )

    app.dependency_overrides[get_settings] = disabled_settings
    try:
        disabled = database_client.get("/api/v1/ai/usage/today", headers=headers)
    finally:
        app.dependency_overrides.pop(get_settings, None)

    assert disabled.status_code == 403
    assert disabled.json()["error"]["code"] == "AI_FEATURE_DISABLED"

