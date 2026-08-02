from starlette.testclient import TestClient

from tests.api.test_auth_sessions import bearer, create_login


def test_user_can_request_development_image_upload(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    response = database_client.post(
        "/api/v1/media/uploads",
        headers=headers,
        json={
            "fileName": "cocktail.jpg",
            "contentType": "image/jpeg",
            "sizeBytes": 1024,
            "purpose": "community-post-image",
        },
    )

    assert response.status_code == 201, response.text
    payload = response.json()
    assert payload["provider"] == "local"
    assert payload["method"] == "PUT"
    assert payload["objectKey"].startswith("community-post-image/")
    assert payload["objectKey"].endswith(".jpg")
    assert payload["publicUrl"].startswith("/media/dev/")


def test_upload_rejects_non_image_content_type(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    response = database_client.post(
        "/api/v1/media/uploads",
        headers=headers,
        json={
            "fileName": "notes.txt",
            "contentType": "text/plain",
            "sizeBytes": 128,
            "purpose": "community-post-image",
        },
    )

    assert response.status_code == 422
