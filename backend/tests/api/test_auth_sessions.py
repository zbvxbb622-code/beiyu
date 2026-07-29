from typing import Any

from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import AuthSession

PHONE = "13800138000"
DEVICE = {
    "installationId": "session-test-installation",
    "platform": "IOS",
    "deviceName": "iPhone 15",
    "appVersion": "1.0.0",
}


def create_login(client: TestClient) -> dict[str, Any]:
    code_response = client.post(
        "/api/v1/auth/sms-codes",
        json={
            "phone": PHONE,
            "scene": "LOGIN",
            "installationId": DEVICE["installationId"],
        },
    )
    assert code_response.status_code == 202
    response = client.post(
        "/api/v1/auth/login",
        json={"phone": PHONE, "code": "123456", "device": DEVICE},
    )
    assert response.status_code == 200
    return response.json()


def bearer(token: object) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_refresh_rotates_token_and_rejects_replay(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    old_refresh_token = login["refreshToken"]

    response = database_client.post(
        "/api/v1/auth/refresh",
        json={"refreshToken": old_refresh_token},
    )

    assert response.status_code == 200, response.text
    refreshed = response.json()
    assert refreshed["accessToken"] != login["accessToken"]
    assert refreshed["refreshToken"] != old_refresh_token
    assert refreshed["expiresIn"] == 900

    replay = database_client.post(
        "/api/v1/auth/refresh",
        json={"refreshToken": old_refresh_token},
    )
    assert replay.status_code == 401
    assert replay.json()["error"]["code"] == "INVALID_REFRESH_TOKEN"


def test_logout_revokes_current_session(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    response = database_client.post("/api/v1/auth/logout", headers=headers)

    assert response.status_code == 204
    auth_session = database_session.exec(select(AuthSession)).one()
    assert auth_session.revoked_at is not None
    protected = database_client.get("/api/v1/auth/devices", headers=headers)
    assert protected.status_code == 401
    assert protected.headers["www-authenticate"] == "Bearer"


def test_protected_route_rejects_missing_or_malformed_bearer(
    database_client: TestClient,
) -> None:
    missing = database_client.get("/api/v1/auth/devices")
    malformed = database_client.get(
        "/api/v1/auth/devices",
        headers={"Authorization": "Bearer not-a-token"},
    )

    assert missing.status_code == 401
    assert missing.json()["error"]["code"] == "AUTHENTICATION_REQUIRED"
    assert missing.headers["www-authenticate"] == "Bearer"
    assert malformed.status_code == 401
    assert malformed.json()["error"]["code"] == "INVALID_ACCESS_TOKEN"
