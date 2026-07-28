from fastapi import FastAPI

from app.api.router import api_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers


def create_app() -> FastAPI:
    get_settings()
    app = FastAPI()
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(api_router)
    return app


app = create_app()
