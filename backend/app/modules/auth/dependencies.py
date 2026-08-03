from dataclasses import dataclass
from datetime import timedelta
from typing import Annotated

import jwt
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlmodel import Session, select

from app.core.config import Settings, get_settings
from app.core.errors import AppError
from app.core.security import decode_access_token
from app.db.models import AuthSession, User, UserDevice, UserStatus
from app.db.models.accounts import utc_now
from app.db.session import get_session

bearer_scheme = HTTPBearer(auto_error=False)


@dataclass(frozen=True, slots=True)
class AuthContext:
    user: User
    session: AuthSession
    device: UserDevice


def _authentication_error(code: str, message: str) -> AppError:
    return AppError(
        code=code,
        message=message,
        status_code=401,
        headers={"WWW-Authenticate": "Bearer"},
    )


def get_auth_context(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None,
        Depends(bearer_scheme),
    ],
    session: Annotated[Session, Depends(get_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> AuthContext:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _authentication_error(
            "AUTHENTICATION_REQUIRED",
            "请先登录",
        )
    try:
        claims = decode_access_token(credentials.credentials, settings.secret_key)
    except jwt.PyJWTError as exc:
        raise _authentication_error(
            "INVALID_ACCESS_TOKEN",
            "登录状态无效或已过期",
        ) from exc

    now = utc_now()
    auth_session = session.exec(
        select(AuthSession).where(
            AuthSession.id == claims.session_id,
            AuthSession.user_id == claims.user_id,
        )
    ).first()
    if (
        auth_session is None
        or auth_session.revoked_at is not None
        or auth_session.expires_at <= now
    ):
        raise _authentication_error(
            "INVALID_ACCESS_TOKEN",
            "登录状态无效或已过期",
        )

    user = session.get(User, claims.user_id)
    device = session.get(UserDevice, auth_session.device_id)
    if (
        user is None
        or user.status is UserStatus.DELETED
        or device is None
        or device.user_id != user.id
        or device.revoked_at is not None
    ):
        raise _authentication_error(
            "INVALID_ACCESS_TOKEN",
            "登录状态无效或已过期",
        )

    if device.last_active_at < now - timedelta(minutes=5):
        device.last_active_at = now
        device.updated_at = now
        session.add(device)
        session.commit()

    return AuthContext(user=user, session=auth_session, device=device)


CurrentAuth = Annotated[AuthContext, Depends(get_auth_context)]
