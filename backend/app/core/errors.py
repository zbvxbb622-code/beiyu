from typing import Any

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse


class AppError(Exception):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int,
        details: dict[str, Any] | None = None,
    ) -> None:
        self.code = code
        self.message = message
        self.status_code = status_code
        self.details = details or {}


def error_response(
    *,
    code: str,
    message: str,
    status_code: int,
    details: dict[str, Any] | None = None,
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error": {
                "code": code,
                "message": message,
                "details": details or {},
            }
        },
    )


async def handle_app_error(_: Request, exc: Exception) -> JSONResponse:
    assert isinstance(exc, AppError)
    return error_response(
        code=exc.code,
        message=exc.message,
        status_code=exc.status_code,
        details=exc.details,
    )


async def handle_request_validation_error(
    _: Request, exc: Exception
) -> JSONResponse:
    assert isinstance(exc, RequestValidationError)
    return error_response(
        code="VALIDATION_ERROR",
        message="输入内容不符合要求",
        status_code=422,
    )


async def handle_unhandled_error(_: Request, __: Exception) -> JSONResponse:
    return error_response(
        code="INTERNAL_ERROR",
        message="服务器内部错误",
        status_code=500,
    )


def register_exception_handlers(app: FastAPI) -> None:
    app.add_exception_handler(AppError, handle_app_error)
    app.add_exception_handler(RequestValidationError, handle_request_validation_error)
    app.add_exception_handler(Exception, handle_unhandled_error)
