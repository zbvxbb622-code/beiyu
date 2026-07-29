import uuid
from datetime import datetime

from pydantic import Field, model_validator

from app.db.models import CellarItemSource
from app.schemas.base import ApiModel


class CellarItemCreate(ApiModel):
    ingredient_id: str | None = Field(default=None, min_length=1, max_length=80)
    custom_name: str | None = Field(default=None, min_length=1, max_length=80)
    amount_label: str | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=200)

    @model_validator(mode="after")
    def require_exactly_one_identity(self) -> "CellarItemCreate":
        if (self.ingredient_id is None) == (self.custom_name is None):
            raise ValueError("provide exactly one of ingredientId or customName")
        return self


class CellarItemPatch(ApiModel):
    amount_label: str | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=200)


class CellarItemResponse(ApiModel):
    id: uuid.UUID
    ingredient_id: str | None
    custom_name: str | None
    amount_label: str | None
    note: str | None
    source: CellarItemSource
    created_at: datetime
    updated_at: datetime


class CellarListResponse(ApiModel):
    items: list[CellarItemResponse]


class CellarBatchRequest(ApiModel):
    ingredient_ids: list[str] = Field(max_length=200)
