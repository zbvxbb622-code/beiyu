import logging
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.core.logging import REQUEST_LOGGER_NAME
from app.db.models import User
from tests.api import test_errors  # noqa: F401
from tests.api.test_auth_sessions import bearer, create_login


def assert_uuid(value: str) -> None:
    assert str(UUID(value)) == value


def test_success_response_generates_a_request_id(client: TestClient) -> None:
    response = client.get("/health/live")

    assert response.status_code == 200
    assert_uuid(response.headers["x-request-id"])


def test_success_response_echoes_a_valid_client_request_id(client: TestClient) -> None:
    request_id = "client-request-123"

    response = client.get("/health/live", headers={"X-Request-ID": request_id})

    assert response.status_code == 200
    assert response.headers["x-request-id"] == request_id


def test_overlong_client_request_id_is_replaced(client: TestClient) -> None:
    request_id = "a" * 129

    response = client.get("/health/live", headers={"X-Request-ID": request_id})

    assert response.status_code == 200
    assert response.headers["x-request-id"] != request_id
    assert_uuid(response.headers["x-request-id"])


def test_control_character_client_request_id_is_replaced(client: TestClient) -> None:
    request_id = "client\x01request-id"

    response = client.get("/health/live", headers={"X-Request-ID": request_id})

    assert response.status_code == 200
    assert response.headers["x-request-id"] != request_id
    assert_uuid(response.headers["x-request-id"])


def test_handled_error_response_includes_a_request_id(client: TestClient) -> None:
    response = client.get("/missing")

    assert response.status_code == 404
    assert_uuid(response.headers["x-request-id"])


def test_unhandled_error_response_includes_a_request_id() -> None:
    with TestClient(test_errors.app, raise_server_exceptions=False) as client:
        response = client.get("/_test/errors/unhandled")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "服务器内部错误",
            "details": {},
        }
    }
    assert_uuid(response.headers["x-request-id"])


def _login_with_ai_access(
    client: TestClient,
    session: Session,
) -> dict[str, object]:
    login = create_login(client)
    user = session.exec(select(User)).one()
    user.age_confirmed_at = datetime(2026, 7, 29, 12, tzinfo=UTC)
    session.add(user)
    session.commit()
    return login


def test_ai_normal_request_log_does_not_include_message_body(
    database_client: TestClient,
    database_session: Session,
    caplog: pytest.LogCaptureFixture,
) -> None:
    login = _login_with_ai_access(database_client, database_session)
    headers = bearer(login["accessToken"])
    created = database_client.post("/api/v1/ai/conversations", headers=headers)
    assert created.status_code == 201, created.text
    secret_text = "日志不能出现的普通聊天正文 7fbd7bd1"
    caplog.set_level(logging.INFO, logger=REQUEST_LOGGER_NAME)

    response = database_client.post(
        f"/api/v1/ai/conversations/{created.json()['id']}/messages",
        headers=headers,
        json={"content": secret_text, "clientMessageId": str(uuid4())},
    )

    assert response.status_code == 200, response.text
    assert secret_text not in caplog.text
    assert "clientMessageId" not in caplog.text
    assert "ai_api_key" not in caplog.text
    assert "ai_memory_hmac_key" not in caplog.text


def test_ai_temporary_request_log_does_not_include_context_or_provider_fields(
    database_client: TestClient,
    database_session: Session,
    caplog: pytest.LogCaptureFixture,
) -> None:
    login = _login_with_ai_access(database_client, database_session)
    headers = bearer(login["accessToken"])
    secret_text = "日志不能出现的临时上下文 9e4a2fb0"
    caplog.set_level(logging.INFO, logger=REQUEST_LOGGER_NAME)

    response = database_client.post(
        "/api/v1/ai/temporary-messages",
        headers=headers,
        json={
            "content": "继续刚才的话题。",
            "clientMessageId": str(uuid4()),
            "context": [{"role": "USER", "content": secret_text}],
        },
    )

    assert response.status_code == 200, response.text
    assert secret_text not in caplog.text
    assert "context" not in caplog.text
    assert "prompt" not in caplog.text
    assert "memory" not in caplog.text
