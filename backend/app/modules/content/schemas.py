from pydantic import Field

from app.schemas.base import ApiModel


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
