from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import User, UserStatus


def require_ai_access(user: User, settings: Settings) -> None:
    if user.status is UserStatus.BANNED:
        raise AppError(
            code="AI_ACCESS_SUSPENDED",
            message="账号暂不可使用 AI",
            status_code=403,
        )
    if user.age_confirmed_at is None:
        raise AppError(
            code="AGE_CONFIRMATION_REQUIRED",
            message="请先完成年龄确认",
            status_code=403,
        )
    if not settings.ai_enabled:
        raise AppError(
            code="AI_FEATURE_DISABLED",
            message="AI 功能暂未开放",
            status_code=403,
        )
