from starlette.testclient import TestClient


def test_liveness(client: TestClient) -> None:
    response = client.get("/health/live")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "beiyu-api"}


def test_api_root(client: TestClient) -> None:
    response = client.get("/api/v1")

    assert response.status_code == 200
    assert response.json() == {"name": "Beiyu API", "version": "v1"}
