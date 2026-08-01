from fastapi import APIRouter
from pydantic import BaseModel

from app.api.routes.admin_content import router as admin_content_router
from app.api.routes.ai import router as ai_router
from app.api.routes.auth import router as auth_router
from app.api.routes.cellar import router as cellar_router
from app.api.routes.community import router as community_router
from app.api.routes.content import router as content_router
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
api_router.include_router(content_router)
api_router.include_router(community_router)
api_router.include_router(admin_content_router)
api_router.include_router(ai_router)
