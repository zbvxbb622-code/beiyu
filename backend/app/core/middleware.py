import logging
import time
from collections.abc import Awaitable, Callable
from typing import Any
from uuid import uuid4

MAX_REQUEST_ID_LENGTH = 128
REQUEST_ID_HEADER = b"x-request-id"
Receive = Callable[[], Awaitable[dict[str, Any]]]
Send = Callable[[dict[str, Any]], Awaitable[None]]


def request_id_from_headers(headers: list[tuple[bytes, bytes]]) -> str:
    for name, value in headers:
        if name.lower() == REQUEST_ID_HEADER:
            candidate = value.decode("latin-1")
            if _is_valid_request_id(candidate):
                return candidate
            break
    return str(uuid4())


def _is_valid_request_id(value: str) -> bool:
    return (
        bool(value)
        and len(value) <= MAX_REQUEST_ID_LENGTH
        and all(32 <= ord(character) <= 126 for character in value)
    )


class RequestContextMiddleware:
    def __init__(self, app: Any, *, environment: str, logger: logging.Logger) -> None:
        self.app = app
        self.environment = environment
        self.logger = logger

    async def __call__(
        self, scope: dict[str, Any], receive: Receive, send: Send
    ) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        request_id = request_id_from_headers(scope["headers"])
        scope.setdefault("state", {})["request_id"] = request_id
        started_at = time.perf_counter()
        status_code = 500

        async def send_with_request_id(message: dict[str, Any]) -> None:
            nonlocal status_code
            if message["type"] == "http.response.start":
                status_code = message["status"]
                message["headers"] = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() != REQUEST_ID_HEADER
                ]
                message["headers"].append(
                    (REQUEST_ID_HEADER, request_id.encode("ascii"))
                )
            await send(message)

        try:
            await self.app(scope, receive, send_with_request_id)
        finally:
            route = scope.get("route")
            path_template = getattr(route, "path", None) or "unmatched"
            self.logger.info(
                "request_completed",
                extra={
                    "structured": {
                        "method": scope["method"],
                        "path_template": path_template,
                        "status": status_code,
                        "duration_ms": round(
                            (time.perf_counter() - started_at) * 1000, 3
                        ),
                        "environment": self.environment,
                        "request_id": request_id,
                    }
                },
            )
