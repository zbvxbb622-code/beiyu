import uuid

from starlette.testclient import TestClient

from tests.api.test_auth_sessions import bearer, create_login


def test_list_devices_marks_current_device(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.get(
        "/api/v1/auth/devices",
        headers=bearer(login["accessToken"]),
    )

    assert response.status_code == 200
    assert response.json() == {
        "items": [
            {
                "id": login["device"]["id"],
                "platform": "IOS",
                "deviceName": "iPhone 15",
                "appVersion": "1.0.0",
                "lastActiveAt": response.json()["items"][0]["lastActiveAt"],
                "isCurrent": True,
            }
        ]
    }


def test_delete_current_device_revokes_its_access(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    response = database_client.delete(
        f"/api/v1/auth/devices/{login['device']['id']}",
        headers=headers,
    )

    assert response.status_code == 204
    assert (
        database_client.get(
            "/api/v1/auth/devices",
            headers=headers,
        ).status_code
        == 401
    )


def test_delete_unknown_device_does_not_reveal_ownership(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.delete(
        f"/api/v1/auth/devices/{uuid.uuid4()}",
        headers=bearer(login["accessToken"]),
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "DEVICE_NOT_FOUND"
