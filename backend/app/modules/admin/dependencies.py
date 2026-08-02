from typing import Annotated

from fastapi import Depends

from app.core.errors import AppError
from app.db.models import UserRole
from app.modules.auth.dependencies import AuthContext, CurrentAuth


def require_editor(auth: CurrentAuth) -> AuthContext:
    if auth.user.role not in {UserRole.EDITOR, UserRole.SUPER_ADMIN}:
        raise AppError(
            code="ADMIN_PERMISSION_REQUIRED",
            message="需要内容管理员权限",
            status_code=403,
        )
    return auth


def require_community_moderator(auth: CurrentAuth) -> AuthContext:
    if auth.user.role not in {UserRole.MODERATOR, UserRole.SUPER_ADMIN}:
        raise AppError(
            code="COMMUNITY_MODERATION_PERMISSION_REQUIRED",
            message="需要社区审核权限",
            status_code=403,
        )
    return auth


AdminAuth = Annotated[AuthContext, Depends(require_editor)]
CommunityModeratorAuth = Annotated[AuthContext, Depends(require_community_moderator)]
