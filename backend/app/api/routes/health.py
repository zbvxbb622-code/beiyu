from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.errors import AppError
from app.db.session import check_database

router = APIRouter(prefix="/health", tags=["health"])


@router.get("/live")
def liveness() -> dict[str, str]:
    return {"status": "ok", "service": "beiyu-api"}


@router.get("/ready")
def readiness(
    database_ready: Annotated[bool, Depends(check_database)],
) -> dict[str, str | dict[str, str]]:
    if not database_ready:
        raise AppError(
            code="SERVICE_UNAVAILABLE",
            message="服务暂不可用",
            status_code=503,
        )
    return {
        "status": "ready",
        "checks": {"database": "ok"},
    }
