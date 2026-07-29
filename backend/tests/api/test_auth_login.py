from datetime import UTC, datetime

from sqlalchemy import func
from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import AuthSession, SmsCode, User, UserDevice, UserProfile

PHONE = "13800138000"
DEVICE = {
    "installationId": "test-installation-id",
    "platform": "IOS",
    "deviceName": "iPhone 15",
    "appVersion": "1.0.0",
}


def request_code(client: TestClient, phone: str = PHONE) -> None:
    response = client.post(
        "/api/v1/auth/sms-codes",
        json={
            "phone": phone,
            "scene": "LOGIN",
            "installationId": DEVICE["installationId"],
        },
    )
    assert response.status_code == 202, response.text


def login(client: TestClient, code: str = "123456"):
    return client.post(
        "/api/v1/auth/login",
        json={"phone": PHONE, "code": code, "device": DEVICE},
    )


def test_request_sms_code_stores_only_hashes(
    database_client: TestClient,
    database_session: Session,
) -> None:
    response = database_client.post(
        "/api/v1/auth/sms-codes",
        json={
            "phone": PHONE,
            "scene": "LOGIN",
            "installationId": DEVICE["installationId"],
        },
    )

    assert response.status_code == 202
    assert response.json() == {"expiresIn": 300, "retryAfter": 60}
    sms_code = database_session.exec(select(SmsCode)).one()
    assert PHONE not in sms_code.phone_hash
    assert sms_code.code_hash != "123456"
    assert sms_code.device_hash != DEVICE["installationId"]
    assert sms_code.expires_at > datetime.now(UTC)


def test_request_sms_code_rate_limits_same_phone(
    database_client: TestClient,
) -> None:
    request_code(database_client)

    response = database_client.post(
        "/api/v1/auth/sms-codes",
        json={
            "phone": PHONE,
            "scene": "LOGIN",
            "installationId": "another-installation",
        },
    )

    assert response.status_code == 429
    assert response.json()["error"]["code"] == "SMS_CODE_TOO_FREQUENT"


def test_first_login_creates_account_profile_device_and_session(
    database_client: TestClient,
    database_session: Session,
) -> None:
    request_code(database_client)

    response = login(database_client)

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["tokenType"] == "bearer"
    assert body["expiresIn"] == 900
    assert body["refreshExpiresIn"] == 7_776_000
    assert body["isNewUser"] is True
    assert body["accessToken"]
    assert body["refreshToken"]
    assert body["user"]["phoneMasked"] == "+86138****8000"
    assert body["user"]["status"] == "ACTIVE"
    assert body["user"]["membershipLevel"] == "FREE"
    assert body["device"]["deviceName"] == "iPhone 15"
    assert body["device"]["isCurrent"] is True
    assert database_session.exec(select(func.count()).select_from(User)).one() == 1
    assert (
        database_session.exec(select(func.count()).select_from(UserProfile)).one() == 1
    )
    assert (
        database_session.exec(select(func.count()).select_from(UserDevice)).one() == 1
    )
    assert (
        database_session.exec(select(func.count()).select_from(AuthSession)).one() == 1
    )
    assert database_session.exec(select(SmsCode)).one().consumed_at is not None


def test_wrong_code_increments_attempts_without_creating_user(
    database_client: TestClient,
    database_session: Session,
) -> None:
    request_code(database_client)

    response = login(database_client, code="654321")

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SMS_CODE"
    assert database_session.exec(select(SmsCode)).one().failed_attempts == 1
    assert database_session.exec(select(func.count()).select_from(User)).one() == 0


def test_consumed_code_cannot_be_reused(
    database_client: TestClient,
) -> None:
    request_code(database_client)
    assert login(database_client).status_code == 200

    response = login(database_client)

    assert response.status_code == 400
    assert response.json()["error"]["code"] == "INVALID_SMS_CODE"
