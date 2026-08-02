from typing import Annotated

from fastapi import APIRouter, Depends, status

from app.core.config import Settings, get_settings
from app.modules.auth.dependencies import CurrentAuth
from app.modules.media.schemas import MediaUploadCreate, MediaUploadResponse
from app.modules.media.service import create_media_upload

router = APIRouter(prefix="/media", tags=["media"])
SettingsDep = Annotated[Settings, Depends(get_settings)]


@router.post(
    "/uploads",
    response_model=MediaUploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_upload(
    payload: MediaUploadCreate,
    auth: CurrentAuth,
    settings: SettingsDep,
) -> MediaUploadResponse:
    return create_media_upload(settings=settings, user=auth.user, payload=payload)
