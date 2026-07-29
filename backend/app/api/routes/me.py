from typing import Annotated

from fastapi import APIRouter, Depends, Response, status
from sqlmodel import Session

from app.core.errors import ErrorEnvelope
from app.db.session import get_session
from app.modules.auth.dependencies import CurrentAuth
from app.modules.users.schemas import (
    AgeConfirmationRequest,
    AgeConfirmationResponse,
    BootstrapResponse,
    DeleteAccountRequest,
    PrivacySettingsPatch,
    PrivacySettingsResponse,
    UserProfilePatch,
    UserProfileResponse,
)
from app.modules.users.service import (
    bootstrap_response,
    confirm_age,
    delete_account,
    get_user_profile,
    privacy_response,
    profile_response,
    update_privacy,
    update_profile,
)

router = APIRouter(prefix="/me", tags=["me"])
SessionDep = Annotated[Session, Depends(get_session)]


@router.get("/bootstrap", response_model=BootstrapResponse)
def bootstrap(session: SessionDep, auth: CurrentAuth) -> BootstrapResponse:
    return bootstrap_response(
        session=session,
        user=auth.user,
        current_device=auth.device,
    )


@router.get("/profile", response_model=UserProfileResponse)
def get_profile(session: SessionDep, auth: CurrentAuth) -> UserProfileResponse:
    return profile_response(get_user_profile(session, auth.user))


@router.patch(
    "/profile",
    response_model=UserProfileResponse,
    responses={422: {"model": ErrorEnvelope}},
)
def patch_profile(
    payload: UserProfilePatch,
    session: SessionDep,
    auth: CurrentAuth,
) -> UserProfileResponse:
    profile = update_profile(
        session=session,
        user=auth.user,
        patch=payload,
    )
    return profile_response(profile)


@router.patch("/privacy", response_model=PrivacySettingsResponse)
def patch_privacy(
    payload: PrivacySettingsPatch,
    session: SessionDep,
    auth: CurrentAuth,
) -> PrivacySettingsResponse:
    profile = update_privacy(
        session=session,
        user=auth.user,
        patch=payload,
    )
    return privacy_response(profile)


@router.post("/age-confirmation", response_model=AgeConfirmationResponse)
def age_confirmation(
    _: AgeConfirmationRequest,
    session: SessionDep,
    auth: CurrentAuth,
) -> AgeConfirmationResponse:
    user = confirm_age(session=session, user=auth.user)
    assert user.age_confirmed_at is not None
    return AgeConfirmationResponse(
        age_confirmed=True,
        confirmed_at=user.age_confirmed_at,
    )


@router.delete(
    "/account",
    status_code=status.HTTP_204_NO_CONTENT,
    responses={401: {"model": ErrorEnvelope}, 422: {"model": ErrorEnvelope}},
)
def remove_account(
    _: DeleteAccountRequest,
    session: SessionDep,
    auth: CurrentAuth,
) -> Response:
    delete_account(session=session, user=auth.user)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
