from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import User, UserProfile, UserStatus
from tests.api.test_auth_sessions import bearer, create_login


def test_profile_defaults_and_partial_update(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    initial = database_client.get("/api/v1/me/profile", headers=headers)
    assert initial.status_code == 200
    assert initial.json() == {
        "nickname": "游客调酒师",
        "avatarKey": "avatarOne",
        "avatarUri": None,
        "signature": "",
        "city": "",
        "gender": None,
        "birthday": None,
        "showBirthdayTag": True,
        "showAge": True,
        "showZodiac": False,
        "occupation": None,
        "school": None,
    }

    updated = database_client.patch(
        "/api/v1/me/profile",
        headers=headers,
        json={
            "nickname": "杯语用户",
            "signature": "今晚也想认真喝一杯",
            "birthday": "2000-08-12",
            "showZodiac": True,
        },
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["nickname"] == "杯语用户"
    assert updated.json()["city"] == ""
    assert updated.json()["birthday"] == "2000-08-12"
    assert updated.json()["showZodiac"] is True


def test_profile_rejects_frontend_overflow(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.patch(
        "/api/v1/me/profile",
        headers=bearer(login["accessToken"]),
        json={"nickname": "超" * 17},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_profile_rejects_null_for_required_display_fields(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.patch(
        "/api/v1/me/profile",
        headers=bearer(login["accessToken"]),
        json={"nickname": None},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_privacy_and_age_confirmation_are_persisted(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    privacy = database_client.patch(
        "/api/v1/me/privacy",
        headers=headers,
        json={"localOnlyMode": False, "syncWhenLoggedIn": True},
    )
    age = database_client.post(
        "/api/v1/me/age-confirmation",
        headers=headers,
        json={"confirmed": True},
    )

    assert privacy.status_code == 200
    assert privacy.json() == {
        "localOnlyMode": False,
        "analyticsOptIn": False,
        "syncWhenLoggedIn": True,
    }
    assert age.status_code == 200
    assert age.json()["ageConfirmed"] is True
    assert database_session.exec(select(User)).one().age_confirmed_at is not None


def test_bootstrap_exposes_mobile_contract_without_internal_secrets(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.get(
        "/api/v1/me/bootstrap",
        headers=bearer(login["accessToken"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["phoneMasked"] == "+86138****8000"
    assert body["profile"]["nickname"] == "游客调酒师"
    assert body["privacy"]["localOnlyMode"] is True
    assert body["accountSecurity"]["phoneVerified"] is True
    assert body["accountSecurity"]["realnameVerified"] is False
    assert body["featureFlags"]["realSms"] is False
    assert body["featureFlags"]["legalNameVerification"] is False
    serialized = response.text
    assert "phoneHash" not in serialized
    assert "refreshToken" not in serialized
    assert "secret" not in serialized.lower()


def test_delete_account_anonymizes_profile_and_revokes_access(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    original_phone_hash = database_session.exec(select(User)).one().phone_hash

    response = database_client.request(
        "DELETE",
        "/api/v1/me/account",
        headers=headers,
        json={"confirmation": "DELETE"},
    )

    assert response.status_code == 204
    user = database_session.exec(select(User)).one()
    profile = database_session.exec(select(UserProfile)).one()
    assert user.status is UserStatus.DELETED
    assert user.deleted_at is not None
    assert user.anonymized_at is not None
    assert user.phone_hash != original_phone_hash
    assert user.phone_hash.startswith("deleted:")
    assert profile.nickname == "已注销用户"
    assert profile.birthday is None
    assert (
        database_client.get(
            "/api/v1/me/profile",
            headers=headers,
        ).status_code
        == 401
    )
