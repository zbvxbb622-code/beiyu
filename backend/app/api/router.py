from fastapi import APIRouter
from pydantic import BaseModel

from app.api.routes.auth import router as auth_router
from app.api.routes.cellar import router as cellar_router
from app.api.routes.me import router as me_router


class ApiRootResponse(BaseModel):
    name: str
    version: str


api_router = APIRouter(prefix="/api/v1", tags=["api"])


@api_router.get("", response_model=ApiRootResponse)
def api_root() -> ApiRootResponse:
    return ApiRootResponse(name="Beiyu API", version="v1")


api_router.include_router(auth_router)
api_router.include_router(me_router)
api_router.include_router(cellar_router)
