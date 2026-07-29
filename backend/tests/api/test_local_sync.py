from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import CellarItem
from tests.api.test_auth_sessions import bearer, create_login


def test_batch_cellar_import_is_idempotent(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    payload = {"ingredientIds": ["gin", "vermouth", "gin"]}

    first = database_client.post(
        "/api/v1/cellar/items/batch",
        headers=headers,
        json=payload,
    )
    second = database_client.post(
        "/api/v1/cellar/items/batch",
        headers=headers,
        json=payload,
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert {item["ingredientId"] for item in second.json()["items"]} == {
        "gin",
        "vermouth",
    }
    assert len(database_session.exec(select(CellarItem)).all()) == 2


def test_local_sync_fills_empty_profile_and_unions_cellar(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    profile = database_client.patch(
        "/api/v1/me/profile",
        headers=headers,
        json={"nickname": "云端名字"},
    )
    assert profile.status_code == 200

    payload = {
        "ageVerified": True,
        "profile": {
            "nickname": "本地旧名字",
            "city": "上海",
            "signature": "本地签名",
        },
        "privacySettings": {
            "localOnlyMode": False,
            "analyticsOptIn": False,
            "syncWhenLoggedIn": True,
        },
        "cellarIngredientIds": ["gin", "rum"],
    }
    first = database_client.post(
        "/api/v1/me/local-sync",
        headers=headers,
        json=payload,
    )
    second = database_client.post(
        "/api/v1/me/local-sync",
        headers=headers,
        json=payload,
    )

    assert first.status_code == 200, first.text
    assert second.status_code == 200
    body = second.json()
    assert body["profile"]["nickname"] == "云端名字"
    assert body["profile"]["city"] == "上海"
    assert body["profile"]["signature"] == "本地签名"
    assert body["privacy"]["syncWhenLoggedIn"] is True
    assert body["user"]["ageConfirmed"] is True
    assert {item["ingredientId"] for item in body["cellar"]["items"]} == {
        "gin",
        "rum",
    }
    assert len(body["cellar"]["items"]) == 2
