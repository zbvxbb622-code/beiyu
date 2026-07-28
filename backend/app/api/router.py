from fastapi import APIRouter

api_router = APIRouter(prefix="/api/v1", tags=["api"])


@api_router.get("")
def api_root() -> dict[str, str]:
    return {"name": "Beiyu API", "version": "v1"}
