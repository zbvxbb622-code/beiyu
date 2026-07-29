from fastapi import HTTPException, Query
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


@app.get("/_test/errors/http-exception")
def raise_http_exception() -> None:
    raise HTTPException(status_code=418, detail="teapot")


@app.get("/_test/errors/http-exception-with-header")
def raise_http_exception_with_header() -> None:
    raise HTTPException(
        status_code=401,
        detail="credentials required",
        headers={"WWW-Authenticate": "Bearer"},
    )


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
    with TestClient(app, raise_server_exceptions=False) as client:
        response = client.get("/_test/errors/unhandled")

    assert response.status_code == 500
    assert response.json() == {
        "error": {
            "code": "INTERNAL_ERROR",
            "message": "服务器内部错误",
            "details": {},
        }
    }


def test_missing_route_uses_the_stable_error_envelope(client: TestClient) -> None:
    response = client.get("/missing")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "NOT_FOUND",
            "message": "资源不存在",
            "details": {},
        }
    }


def test_raised_http_exception_does_not_expose_its_detail(
    client: TestClient,
) -> None:
    response = client.get("/_test/errors/http-exception")

    assert response.status_code == 418
    assert response.json() == {
        "error": {
            "code": "HTTP_ERROR",
            "message": "请求失败",
            "details": {},
        }
    }


def test_raised_http_exception_preserves_protocol_headers(
    client: TestClient,
) -> None:
    response = client.get("/_test/errors/http-exception-with-header")

    assert response.status_code == 401
    assert response.json() == {
        "error": {
            "code": "HTTP_ERROR",
            "message": "请求失败",
            "details": {},
        }
    }
    assert response.headers["www-authenticate"] == "Bearer"
