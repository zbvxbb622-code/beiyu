from fastapi import FastAPI

from app.api.router import api_router
from app.api.routes.health import router as health_router
from app.core.config import get_settings
from app.core.errors import register_exception_handlers
from app.core.logging import configure_request_logging
from app.core.middleware import RequestContextMiddleware


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI()
    app.add_middleware(
        RequestContextMiddleware,
        environment=settings.environment,
        logger=configure_request_logging(),
    )
    register_exception_handlers(app)
    app.include_router(health_router)
    app.include_router(api_router)
    return app


app = create_app()
