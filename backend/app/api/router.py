from fastapi import APIRouter
from pydantic import BaseModel


class ApiRootResponse(BaseModel):
    name: str
    version: str


api_router = APIRouter(prefix="/api/v1", tags=["api"])


@api_router.get("", response_model=ApiRootResponse)
def api_root() -> ApiRootResponse:
    return ApiRootResponse(name="Beiyu API", version="v1")
