from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from app.core.errors import AppError, ErrorEnvelope
from app.db.session import check_database

router = APIRouter(prefix="/health", tags=["health"])


class LivenessResponse(BaseModel):
    status: str
    service: str


class ReadinessChecks(BaseModel):
    database: str


class ReadinessResponse(BaseModel):
    status: str
    checks: ReadinessChecks


@router.get("/live", response_model=LivenessResponse)
def liveness() -> LivenessResponse:
    return LivenessResponse(status="ok", service="beiyu-api")


@router.get(
    "/ready",
    response_model=ReadinessResponse,
    responses={
        503: {
            "model": ErrorEnvelope,
            "description": "Service Unavailable",
        }
    },
)
def readiness(
    database_ready: Annotated[bool, Depends(check_database)],
) -> ReadinessResponse:
    if not database_ready:
        raise AppError(
            code="SERVICE_UNAVAILABLE",
            message="服务暂不可用",
            status_code=503,
        )
    return ReadinessResponse(
        status="ready",
        checks=ReadinessChecks(database="ok"),
    )
