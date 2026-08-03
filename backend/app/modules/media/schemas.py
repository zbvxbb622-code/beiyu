from typing import Literal

from pydantic import Field, field_validator

from app.schemas.base import ApiModel

MediaPurpose = Literal["community-post-image", "avatar"]
MediaProviderName = Literal["local", "oss"]
UploadMethod = Literal["PUT"]


class MediaUploadCreate(ApiModel):
    file_name: str = Field(min_length=1, max_length=180)
    content_type: str = Field(min_length=1, max_length=120)
    size_bytes: int = Field(gt=0)
    purpose: MediaPurpose

    @field_validator("file_name")
    @classmethod
    def strip_file_name(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("file name cannot be blank")
        return stripped

    @field_validator("content_type")
    @classmethod
    def normalize_content_type(cls, value: str) -> str:
        return value.strip().lower()


class MediaUploadResponse(ApiModel):
    id: str
    provider: MediaProviderName
    method: UploadMethod = "PUT"
    upload_url: str
    public_url: str
    object_key: str
    headers: dict[str, str]
    max_bytes: int
