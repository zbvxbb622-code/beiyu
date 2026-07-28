from fastapi import Query
from starlette.testclient import TestClient

from app.core.errors import AppError
from app.main import app


@app.get("/_test/errors/app-error")
def raise_app_error() -> None:
    raise AppError("RESOURCE_CONFLICT", "资源状态冲突", 409, {"field": "id"})


@app.get("/_test/errors/validation")
def validate_query(limit: int = Query()) -> dict[str, int]:
    return {"limit": limit}


@app.get("/_test/errors/unhandled")
def raise_unhandled_error() -> None:
    raise RuntimeError("database connection details")


def test_app_error_uses_the_stable_error_envelope(client: TestClient) -> None:
    response = client.get("/_test/errors/app-error")

    assert response.status_code == 409
    assert response.json() == {
        "error": {
            "code": "RESOURCE_CONFLICT",
            "message": "资源状态冲突",
            "details": {"field": "id"},
        }
    }


def test_request_validation_uses_the_stable_error_envelope(client: TestClient) -> None:
    response = client.get("/_test/errors/validation?limit=not-an-integer")

    assert response.status_code == 422
    assert response.json() == {
        "error": {
            "code": "VALIDATION_ERROR",
            "message": "输入内容不符合要求",
            "details": {},
        }
    }


def test_unhandled_errors_do_not_expose_internal_details() -> None:
    response = TestClient(app, raise_server_exceptions=False).get(
        "/_test/errors/unhandled"
    )

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "服务器内部错误",
            "details": {},
        }
    }
