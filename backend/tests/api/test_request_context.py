from uuid import UUID

from starlette.testclient import TestClient


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
