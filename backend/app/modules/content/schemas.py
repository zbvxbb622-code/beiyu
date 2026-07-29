from datetime import datetime
from typing import Annotated, Any
from urllib.parse import urlsplit

from pydantic import AfterValidator, Field, StringConstraints, field_validator

from app.schemas.base import ApiModel


def _validate_http_url(value: str) -> str:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError("image URL must use HTTP or HTTPS")
    return value


ImageUrl = Annotated[
    str,
    StringConstraints(max_length=2048),
    AfterValidator(_validate_http_url),
]


class PaginationResponse(ApiModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class IngredientResponse(ApiModel):
    id: str
    name: str
    category: str


class CocktailIngredientResponse(IngredientResponse):
    amount: str


class RecipeResponse(ApiModel):
    id: str
    name: str
    english_name: str
    description: str
    tags: list[str]
    ingredients: list[CocktailIngredientResponse]
    steps: list[str]
    image_key: str
    image_url: str | None = None
    difficulty: str
    prep_minutes: int


class RecipeListResponse(ApiModel):
    items: list[RecipeResponse]
    pagination: PaginationResponse


class IngredientListResponse(ApiModel):
    items: list[IngredientResponse]
    pagination: PaginationResponse


class HeroSlideResponse(ApiModel):
    id: str
    brand: str
    title: str
    subtitle: str
    script_label: str
    cta_label: str
    image_key: str
    image_url: str | None = None
    target_route: str


class HomeShortcutResponse(ApiModel):
    id: str
    title: str
    description: str
    icon: str
    route: str


class BarMenuItemResponse(ApiModel):
    id: str
    name: str
    image_key: str
    likes: int = Field(ge=0)
    badge: str | None = None


class BarReviewResponse(ApiModel):
    id: str
    author_name: str
    author_avatar_key: str
    text: str
    date: str
    likes: int = Field(ge=0)
    image_keys: list[str] = Field(default_factory=list)


class BarResponse(ApiModel):
    id: str
    name: str
    image_key: str
    image_url: str | None = None
    rating: float
    review_count: int
    average_spend: int
    distance_label: str
    metro_hint: str
    address: str
    open_hours: str
    description: str
    tags: list[str]
    taste_score: float
    environment_score: float
    service_score: float
    phone: str
    menu: list[BarMenuItemResponse]
    reviews: list[BarReviewResponse]


class BarListResponse(ApiModel):
    items: list[BarResponse]
    pagination: PaginationResponse


class KnowledgeResponse(ApiModel):
    id: str
    recipe_id: str | None = None
    name: str
    english_name: str
    image_key: str
    image_url: str | None = None
    era: str
    meaning: str
    story: str
    symbols: list[str]


class KnowledgeListResponse(ApiModel):
    items: list[KnowledgeResponse]
    pagination: PaginationResponse


class HomeResponse(ApiModel):
    banners: list[HeroSlideResponse]
    shortcuts: list[HomeShortcutResponse]
    featured_recipes: list[RecipeResponse]
    featured_bars: list[BarResponse]


class SearchResultResponse(ApiModel):
    type: str
    id: str
    title: str
    subtitle: str
    image_key: str
    image_url: str | None = None


class SearchListResponse(ApiModel):
    items: list[SearchResultResponse]
    pagination: PaginationResponse


class AdminRecipeResponse(RecipeResponse):
    status: str
    revision: int


class AdminRecipeListResponse(ApiModel):
    items: list[AdminRecipeResponse]


class RecipeIngredientWrite(ApiModel):
    id: str = Field(min_length=1, max_length=120)
    amount: str = Field(min_length=1, max_length=80)


class RecipeCreate(ApiModel):
    public_id: str = Field(alias="id", min_length=1, max_length=120)
    name: str = Field(min_length=1, max_length=120)
    english_name: str = Field(min_length=1, max_length=160)
    description: str = Field(min_length=1, max_length=2000)
    tags: list[str] = Field(max_length=30)
    ingredients: list[RecipeIngredientWrite] = Field(min_length=1, max_length=50)
    steps: list[str] = Field(min_length=1, max_length=30)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None
    difficulty: str = Field(pattern=r"^(入门|进阶|专业)$")
    prep_minutes: int = Field(ge=0, le=1440)

    @field_validator("ingredients")
    @classmethod
    def ingredients_are_unique(
        cls,
        ingredients: list[RecipeIngredientWrite],
    ) -> list[RecipeIngredientWrite]:
        ids = [item.id for item in ingredients]
        if len(ids) != len(set(ids)):
            raise ValueError("recipe ingredients must be unique")
        return ingredients


class RecipePatch(ApiModel):
    expected_revision: int = Field(ge=1)
    name: str | None = Field(default=None, min_length=1, max_length=120)
    english_name: str | None = Field(default=None, min_length=1, max_length=160)
    description: str | None = Field(default=None, min_length=1, max_length=2000)
    tags: list[str] | None = Field(default=None, max_length=30)
    ingredients: list[RecipeIngredientWrite] | None = Field(
        default=None,
        min_length=1,
        max_length=50,
    )
    steps: list[str] | None = Field(default=None, min_length=1, max_length=30)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: ImageUrl | None = None
    difficulty: str | None = Field(default=None, pattern=r"^(入门|进阶|专业)$")
    prep_minutes: int | None = Field(default=None, ge=0, le=1440)

    @field_validator("ingredients")
    @classmethod
    def patch_ingredients_are_unique(
        cls,
        ingredients: list[RecipeIngredientWrite] | None,
    ) -> list[RecipeIngredientWrite] | None:
        if ingredients is None:
            return None
        ids = [item.id for item in ingredients]
        if len(ids) != len(set(ids)):
            raise ValueError("recipe ingredients must be unique")
        return ingredients


class RevisionRequest(ApiModel):
    expected_revision: int = Field(ge=1)


class RollbackRequest(RevisionRequest):
    version_no: int = Field(ge=1)


class ContentVersionResponse(ApiModel):
    version_no: int
    action: str
    snapshot: dict[str, Any]
    created_at: datetime


class ContentVersionListResponse(ApiModel):
    items: list[ContentVersionResponse]
