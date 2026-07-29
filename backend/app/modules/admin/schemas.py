from datetime import datetime
from typing import Literal

from pydantic import Field

from app.db.models import IngredientCategory
from app.modules.content.schemas import (
    BarMenuItemResponse,
    BarReviewResponse,
    ImageUrl,
)
from app.schemas.base import ApiModel


class IngredientCreate(ApiModel):
    public_id: str = Field(alias="id", min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=80)
    category: IngredientCategory
    description: str | None = Field(default=None, max_length=500)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None


class IngredientPatch(ApiModel):
    expected_revision: int = Field(ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=80)
    category: IngredientCategory | None = None
    description: str | None = Field(default=None, max_length=500)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None


class AdminIngredientResponse(ApiModel):
    id: str
    name: str
    category: IngredientCategory
    description: str | None
    image_key: str | None
    image_url: str | None
    status: str
    revision: int


class AdminIngredientListResponse(ApiModel):
    items: list[AdminIngredientResponse]


class BarCreate(ApiModel):
    public_id: str = Field(alias="id", min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None
    rating: float = Field(ge=0, le=5)
    review_count: int = Field(ge=0)
    average_spend: int = Field(ge=0)
    distance_label: str = Field(max_length=80)
    metro_hint: str = Field(max_length=160)
    address: str = Field(max_length=240)
    open_hours: str = Field(max_length=160)
    description: str = Field(max_length=4000)
    tags: list[str] = Field(max_length=30)
    taste_score: float = Field(ge=0, le=5)
    environment_score: float = Field(ge=0, le=5)
    service_score: float = Field(ge=0, le=5)
    phone: str = Field(max_length=40)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    menu: list[BarMenuItemResponse] = Field(max_length=100)
    reviews: list[BarReviewResponse] = Field(max_length=100)


class BarPatch(ApiModel):
    expected_revision: int = Field(ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None
    rating: float | None = Field(default=None, ge=0, le=5)
    review_count: int | None = Field(default=None, ge=0)
    average_spend: int | None = Field(default=None, ge=0)
    distance_label: str | None = Field(default=None, max_length=80)
    metro_hint: str | None = Field(default=None, max_length=160)
    address: str | None = Field(default=None, max_length=240)
    open_hours: str | None = Field(default=None, max_length=160)
    description: str | None = Field(default=None, max_length=4000)
    tags: list[str] | None = Field(default=None, max_length=30)
    taste_score: float | None = Field(default=None, ge=0, le=5)
    environment_score: float | None = Field(default=None, ge=0, le=5)
    service_score: float | None = Field(default=None, ge=0, le=5)
    phone: str | None = Field(default=None, max_length=40)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    menu: list[BarMenuItemResponse] | None = Field(default=None, max_length=100)
    reviews: list[BarReviewResponse] | None = Field(default=None, max_length=100)


class AdminBarResponse(BarCreate):
    status: str
    revision: int


class AdminBarListResponse(ApiModel):
    items: list[AdminBarResponse]


class KnowledgeCreate(ApiModel):
    public_id: str = Field(alias="id", min_length=1, max_length=120)
    recipe_id: str | None = Field(default=None, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    english_name: str = Field(min_length=1, max_length=160)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None
    era: str = Field(min_length=1, max_length=240)
    meaning: str = Field(min_length=1, max_length=500)
    story: str = Field(min_length=1, max_length=6000)
    symbols: list[str] = Field(max_length=30)


class KnowledgePatch(ApiModel):
    expected_revision: int = Field(ge=1)
    recipe_id: str | None = Field(default=None, max_length=120)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    english_name: str | None = Field(default=None, min_length=1, max_length=160)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None
    era: str | None = Field(default=None, min_length=1, max_length=240)
    meaning: str | None = Field(default=None, min_length=1, max_length=500)
    story: str | None = Field(default=None, min_length=1, max_length=6000)
    symbols: list[str] | None = Field(default=None, max_length=30)


class AdminKnowledgeResponse(KnowledgeCreate):
    status: str
    revision: int


class AdminKnowledgeListResponse(ApiModel):
    items: list[AdminKnowledgeResponse]


class BannerCreate(ApiModel):
    public_id: str = Field(alias="id", min_length=1, max_length=120)
    brand: str = Field(min_length=1, max_length=80)
    title: str = Field(min_length=1, max_length=160)
    subtitle: str = Field(min_length=1, max_length=160)
    script_label: str = Field(max_length=80)
    cta_label: str = Field(max_length=80)
    target_route: Literal[
        "/ai",
        "/recipes",
        "/bars",
        "/drink-knowledge",
        "/blind-box",
        "/cellar",
    ]
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None
    sort_order: int = Field(ge=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class BannerPatch(ApiModel):
    expected_revision: int = Field(ge=1)
    brand: str | None = Field(default=None, min_length=1, max_length=80)
    title: str | None = Field(default=None, min_length=1, max_length=160)
    subtitle: str | None = Field(default=None, min_length=1, max_length=160)
    script_label: str | None = Field(default=None, max_length=80)
    cta_label: str | None = Field(default=None, max_length=80)
    target_route: Literal[
        "/ai",
        "/recipes",
        "/bars",
        "/drink-knowledge",
        "/blind-box",
        "/cellar",
    ] | None = None
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None
    sort_order: int | None = Field(default=None, ge=0)
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class AdminBannerResponse(BannerCreate):
    status: str
    revision: int


class AdminBannerListResponse(ApiModel):
    items: list[AdminBannerResponse]


class ShortcutCreate(ApiModel):
    public_id: str = Field(alias="id", min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=80)
    description: str = Field(max_length=240)
    icon: Literal["box", "book", "cards", "cellar"]
    route: Literal[
        "/ai",
        "/recipes",
        "/bars",
        "/drink-knowledge",
        "/blind-box",
        "/cellar",
    ]
    sort_order: int = Field(ge=0)


class ShortcutPatch(ApiModel):
    expected_revision: int = Field(ge=1)
    title: str | None = Field(default=None, min_length=1, max_length=80)
    description: str | None = Field(default=None, max_length=240)
    icon: Literal["box", "book", "cards", "cellar"] | None = None
    route: Literal[
        "/ai",
        "/recipes",
        "/bars",
        "/drink-knowledge",
        "/blind-box",
        "/cellar",
    ] | None = None
    sort_order: int | None = Field(default=None, ge=0)


class AdminShortcutResponse(ShortcutCreate):
    status: str
    revision: int


class AdminShortcutListResponse(ApiModel):
    items: list[AdminShortcutResponse]
