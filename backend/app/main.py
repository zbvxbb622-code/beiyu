from fastapi import FastAPI

from app.api.router import api_router
from app.api.routes.health import router as health_router
from app.core.errors import register_exception_handlers

app = FastAPI()
register_exception_handlers(app)
app.include_router(health_router)
app.include_router(api_router)
