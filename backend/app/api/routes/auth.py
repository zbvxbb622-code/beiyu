import ipaddress
from typing import Annotated

from fastapi import APIRouter, Depends, Request, status
from sqlmodel import Session

from app.core.config import Settings, get_settings
from app.core.errors import ErrorEnvelope
from app.db.session import get_session
from app.integrations.sms import SmsProvider, get_sms_provider_dependency
from app.modules.auth.schemas import (
    AuthenticatedDevice,
    AuthenticatedUser,
    LoginRequest,
    LoginResponse,
    SmsCodeAccepted,
    SmsCodeRequest,
)
from app.modules.auth.service import issue_sms_code, login_with_sms

router = APIRouter(prefix="/auth", tags=["auth"])

SessionDep = Annotated[Session, Depends(get_session)]
SettingsDep = Annotated[Settings, Depends(get_settings)]
SmsProviderDep = Annotated[SmsProvider, Depends(get_sms_provider_dependency)]


@router.post(
    "/sms-codes",
    response_model=SmsCodeAccepted,
    status_code=status.HTTP_202_ACCEPTED,
    responses={400: {"model": ErrorEnvelope}, 422: {"model": ErrorEnvelope}},
)
def request_sms_code(
    payload: SmsCodeRequest,
    request: Request,
    session: SessionDep,
    settings: SettingsDep,
    provider: SmsProviderDep,
) -> SmsCodeAccepted:
    client_host = request.client.host if request.client else "127.0.0.1"
    try:
        ipaddress.ip_address(client_host)
    except ValueError:
        client_host = "127.0.0.1"
    issue_sms_code(
        session=session,
        provider=provider,
        settings=settings,
        raw_phone=payload.phone,
        scene=payload.scene,
        installation_id=payload.installation_id,
        ip_address=client_host,
    )
    return SmsCodeAccepted(
        expires_in=settings.otp_expires_seconds,
        retry_after=settings.otp_retry_after_seconds,
    )


@router.post(
    "/login",
    response_model=LoginResponse,
    responses={400: {"model": ErrorEnvelope}, 403: {"model": ErrorEnvelope}},
)
def login(
    payload: LoginRequest,
    session: SessionDep,
    settings: SettingsDep,
) -> LoginResponse:
    result = login_with_sms(
        session=session,
        settings=settings,
        raw_phone=payload.phone,
        code=payload.code,
        device_input=payload.device,
    )
    return LoginResponse(
        access_token=result.access_token,
        refresh_token=result.refresh_token,
        expires_in=settings.access_token_minutes * 60,
        refresh_expires_in=settings.refresh_token_days * 24 * 60 * 60,
        is_new_user=result.is_new_user,
        user=AuthenticatedUser(
            id=result.user.id,
            phone_masked=result.user.phone_masked,
            status=result.user.status,
            age_confirmed=result.user.age_confirmed_at is not None,
            memory_enabled=result.user.memory_enabled,
            membership_level=result.user.membership_level,
        ),
        device=AuthenticatedDevice(
            id=result.device.id,
            platform=result.device.platform,
            device_name=result.device.device_name,
            app_version=result.device.app_version,
            last_active_at=result.device.last_active_at,
            is_current=True,
        ),
    )
