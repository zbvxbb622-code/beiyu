from datetime import UTC, datetime, timedelta

from sqlalchemy import func
from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import (
    AuthSession,
    SmsCode,
    User,
    UserDevice,
    UserProfile,
    UserStatus,
)
from tests.api.test_auth_sessions import bearer

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


def test_new_sms_code_consumes_earlier_active_code(
    database_client: TestClient,
    database_session: Session,
) -> None:
    request_code(database_client)
    first = database_session.exec(select(SmsCode)).one()
    first.created_at = datetime.now(UTC) - timedelta(seconds=61)
    database_session.add(first)
    database_session.commit()

    request_code(database_client)

    codes = sorted(
        database_session.exec(select(SmsCode)).all(),
        key=lambda sms_code: sms_code.created_at,
    )
    assert len(codes) == 2
    assert codes[0].consumed_at is not None
    assert codes[1].consumed_at is None


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


def test_banned_user_can_authenticate_but_deleted_user_cannot(
    database_client: TestClient,
    database_session: Session,
) -> None:
    request_code(database_client)
    authenticated = login(database_client).json()
    user = database_session.exec(select(User)).one()

    user.status = UserStatus.BANNED
    database_session.add(user)
    database_session.commit()

    banned = database_client.get(
        "/api/v1/me/profile",
        headers=bearer(authenticated["accessToken"]),
    )
    assert banned.status_code == 200, banned.text

    user.status = UserStatus.DELETED
    database_session.add(user)
    database_session.commit()

    deleted = database_client.get(
        "/api/v1/me/profile",
        headers=bearer(authenticated["accessToken"]),
    )
    assert deleted.status_code == 401
