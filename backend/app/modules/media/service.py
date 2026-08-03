import posixpath
import uuid
from urllib.parse import quote

from app.core.config import MediaProvider, Settings
from app.core.errors import AppError
from app.db.models import User
from app.modules.media.schemas import MediaUploadCreate, MediaUploadResponse

SUPPORTED_IMAGE_TYPES = {
    "image/jpeg": ".jpg",
    "image/png": ".png",
    "image/webp": ".webp",
}


def create_media_upload(
    *,
    settings: Settings,
    user: User,
    payload: MediaUploadCreate,
) -> MediaUploadResponse:
    extension = SUPPORTED_IMAGE_TYPES.get(payload.content_type)
    if extension is None:
        raise AppError(
            "UNSUPPORTED_MEDIA_TYPE",
            "仅支持 JPG、PNG 或 WebP 图片",
            422,
        )
    if payload.size_bytes > settings.media_upload_max_bytes:
        raise AppError(
            "MEDIA_TOO_LARGE",
            "图片大小超过限制",
            413,
            {"maxBytes": settings.media_upload_max_bytes},
        )

    upload_id = str(uuid.uuid4())
    object_key = _build_object_key(payload.purpose, user.id, upload_id, extension)
    headers = {"Content-Type": payload.content_type}

    if settings.media_provider is MediaProvider.LOCAL:
        quoted_key = quote(object_key)
        return MediaUploadResponse(
            id=upload_id,
            provider="local",
            upload_url=f"local://beiyu-dev-upload/{quoted_key}",
            public_url=f"/media/dev/{quoted_key}",
            object_key=object_key,
            headers=headers,
            max_bytes=settings.media_upload_max_bytes,
        )

    assert settings.media_public_base_url is not None
    assert settings.media_oss_bucket is not None
    assert settings.media_oss_endpoint is not None
    quoted_key = quote(object_key)
    public_base = settings.media_public_base_url.rstrip("/")
    endpoint = settings.media_oss_endpoint.removeprefix("https://").removeprefix("http://").rstrip("/")
    return MediaUploadResponse(
        id=upload_id,
        provider="oss",
        upload_url=f"https://{settings.media_oss_bucket}.{endpoint}/{quoted_key}",
        public_url=f"{public_base}/{quoted_key}",
        object_key=object_key,
        headers=headers,
        max_bytes=settings.media_upload_max_bytes,
    )


def _build_object_key(
    purpose: str,
    user_id: uuid.UUID,
    upload_id: str,
    extension: str,
) -> str:
    return posixpath.join(purpose, str(user_id), f"{upload_id}{extension}")
