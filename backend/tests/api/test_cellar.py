import uuid

from starlette.testclient import TestClient

from tests.api.test_auth_sessions import bearer, create_login


def test_cellar_crud_is_private_and_soft_deletes(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    created = database_client.post(
        "/api/v1/cellar/items",
        headers=headers,
        json={"ingredientId": "gin", "amountLabel": "半瓶", "note": "适合金汤力"},
    )

    assert created.status_code == 201, created.text
    item = created.json()
    assert item["ingredientId"] == "gin"
    assert item["customName"] is None
    listed = database_client.get("/api/v1/cellar/items", headers=headers)
    assert [entry["id"] for entry in listed.json()["items"]] == [item["id"]]

    updated = database_client.patch(
        f"/api/v1/cellar/items/{item['id']}",
        headers=headers,
        json={"amountLabel": "一瓶", "note": None},
    )
    assert updated.status_code == 200
    assert updated.json()["amountLabel"] == "一瓶"
    assert updated.json()["note"] is None

    deleted = database_client.delete(
        f"/api/v1/cellar/items/{item['id']}",
        headers=headers,
    )
    assert deleted.status_code == 204
    assert (
        database_client.get(
            "/api/v1/cellar/items",
            headers=headers,
        ).json()["items"]
        == []
    )


def test_custom_name_deduplicates_normalized_value(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    first = database_client.post(
        "/api/v1/cellar/items",
        headers=headers,
        json={"customName": "  自制 梅酒  "},
    )
    duplicate = database_client.post(
        "/api/v1/cellar/items",
        headers=headers,
        json={"customName": "自制   梅酒"},
    )

    assert first.status_code == 201
    assert first.json()["customName"] == "自制 梅酒"
    assert duplicate.status_code == 409
    assert duplicate.json()["error"]["code"] == "CELLAR_ITEM_EXISTS"


def test_cellar_rejects_blank_identity(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.post(
        "/api/v1/cellar/items",
        headers=bearer(login["accessToken"]),
        json={"customName": "   "},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_unknown_item_returns_scoped_not_found(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.patch(
        f"/api/v1/cellar/items/{uuid.uuid4()}",
        headers=bearer(login["accessToken"]),
        json={"note": "不可见"},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "CELLAR_ITEM_NOT_FOUND"
