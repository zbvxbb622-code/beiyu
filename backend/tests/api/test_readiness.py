from starlette.testclient import TestClient

from app.db.session import check_database


def test_readiness_succeeds_when_database_is_reachable(
    client: TestClient,
) -> None:
    client.app.dependency_overrides[check_database] = lambda: True

    try:
        response = client.get("/health/ready")
    finally:
        client.app.dependency_overrides.pop(check_database, None)

    assert response.status_code == 200
    assert response.json() == {
        "status": "ready",
        "checks": {"database": "ok"},
    }


def test_readiness_hides_database_connection_details(
    client: TestClient,
) -> None:
    client.app.dependency_overrides[check_database] = lambda: False

    try:
        response = client.get("/health/ready")
    finally:
        client.app.dependency_overrides.pop(check_database, None)

    assert response.status_code == 503
    assert response.json() == {
        "error": {
            "code": "SERVICE_UNAVAILABLE",
            "message": "服务暂不可用",
            "details": {},
        }
    }
    assert "password=secret" not in response.text
