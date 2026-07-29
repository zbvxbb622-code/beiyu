import uuid
from datetime import datetime
from decimal import Decimal
from enum import StrEnum

from sqlalchemy import JSON, DateTime, Enum, Numeric, UniqueConstraint
from sqlalchemy.dialects.postgresql import JSONB
from sqlmodel import Column, Field, SQLModel

from app.db.models.accounts import utc_now


def json_column() -> Column:
    return Column(JSON().with_variant(JSONB, "postgresql"), nullable=False)


class ContentStatus(StrEnum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"


class ContentType(StrEnum):
    INGREDIENT = "INGREDIENT"
    RECIPE = "RECIPE"
    BAR = "BAR"
    KNOWLEDGE = "KNOWLEDGE"
    BANNER = "BANNER"
    SHORTCUT = "SHORTCUT"


class ContentAction(StrEnum):
    CREATE = "CREATE"
    UPDATE = "UPDATE"
    PUBLISH = "PUBLISH"
    ARCHIVE = "ARCHIVE"
    ROLLBACK = "ROLLBACK"


class IngredientCategory(StrEnum):
    BASE = "base"
    LIQUEUR = "liqueur"
    CITRUS = "citrus"
    MIXER = "mixer"
    SWEETENER = "sweetener"
    GARNISH = "garnish"
    TOOL = "tool"


class ContentRecord(SQLModel):
    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    public_id: str = Field(max_length=120, index=True)
    status: ContentStatus = Field(
        default=ContentStatus.DRAFT,
        index=True,
    )
    revision: int = Field(default=1, ge=1)
    published_at: datetime | None = None
    created_at: datetime = Field(default_factory=utc_now)
    updated_at: datetime = Field(default_factory=utc_now)


class Ingredient(ContentRecord, table=True):
    __tablename__ = "ingredients"
    __table_args__ = (
        UniqueConstraint("public_id", name="uq_ingredients_public_id"),
    )

    name: str = Field(max_length=80)
    category: IngredientCategory = Field(
        sa_column=Column(
            Enum(IngredientCategory, name="ingredient_category"),
            nullable=False,
            index=True,
        ),
    )
    description: str | None = Field(default=None, max_length=500)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: str | None = Field(default=None, max_length=2048)


class Recipe(ContentRecord, table=True):
    __tablename__ = "recipes"
    __table_args__ = (UniqueConstraint("public_id", name="uq_recipes_public_id"),)

    name: str = Field(max_length=120)
    english_name: str = Field(max_length=160)
    description: str = Field(max_length=2000)
    tags: list[str] = Field(default_factory=list, sa_column=json_column())
    steps: list[str] = Field(default_factory=list, sa_column=json_column())
    image_key: str | None = Field(default=None, max_length=80)
    image_url: str | None = Field(default=None, max_length=2048)
    difficulty: str = Field(default="入门", max_length=20)
    prep_minutes: int = Field(default=0, ge=0)


class RecipeIngredient(SQLModel, table=True):
    __tablename__ = "recipe_ingredients"
    __table_args__ = (
        UniqueConstraint(
            "recipe_id",
            "ingredient_id",
            name="uq_recipe_ingredients_pair",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    recipe_id: uuid.UUID = Field(
        foreign_key="recipes.id",
        ondelete="CASCADE",
        index=True,
    )
    ingredient_id: uuid.UUID = Field(
        foreign_key="ingredients.id",
        ondelete="RESTRICT",
        index=True,
    )
    amount: str = Field(max_length=80)
    sort_order: int = Field(default=0, ge=0)


class Bar(ContentRecord, table=True):
    __tablename__ = "bars"
    __table_args__ = (UniqueConstraint("public_id", name="uq_bars_public_id"),)

    name: str = Field(max_length=120)
    description: str = Field(default="", max_length=4000)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: str | None = Field(default=None, max_length=2048)
    rating: float = Field(default=0.0, ge=0, le=5)
    review_count: int = Field(default=0, ge=0)
    average_spend: int = Field(default=0, ge=0)
    distance_label: str = Field(default="", max_length=80)
    metro_hint: str = Field(default="", max_length=160)
    address: str = Field(default="", max_length=240)
    open_hours: str = Field(default="", max_length=160)
    tags: list[str] = Field(default_factory=list, sa_column=json_column())
    taste_score: float = Field(default=0.0, ge=0, le=5)
    environment_score: float = Field(default=0.0, ge=0, le=5)
    service_score: float = Field(default=0.0, ge=0, le=5)
    phone: str = Field(default="", max_length=40)
    latitude: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 7), nullable=True),
    )
    longitude: Decimal | None = Field(
        default=None,
        sa_column=Column(Numeric(10, 7), nullable=True),
    )
    menu: list[dict[str, object]] = Field(default_factory=list, sa_column=json_column())
    featured_reviews: list[dict[str, object]] = Field(
        default_factory=list,
        sa_column=json_column(),
    )


class DrinkKnowledgeEntry(ContentRecord, table=True):
    __tablename__ = "drink_knowledge_entries"
    __table_args__ = (
        UniqueConstraint(
            "public_id",
            name="uq_drink_knowledge_entries_public_id",
        ),
    )

    recipe_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="recipes.id",
        ondelete="SET NULL",
        index=True,
    )
    name: str = Field(max_length=120)
    english_name: str = Field(max_length=160)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: str | None = Field(default=None, max_length=2048)
    era: str = Field(max_length=240)
    meaning: str = Field(max_length=500)
    story: str = Field(max_length=6000)
    symbols: list[str] = Field(default_factory=list, sa_column=json_column())


class HomeBanner(ContentRecord, table=True):
    __tablename__ = "home_banners"
    __table_args__ = (
        UniqueConstraint("public_id", name="uq_home_banners_public_id"),
    )

    brand: str = Field(max_length=80)
    title: str = Field(max_length=160)
    subtitle: str = Field(max_length=160)
    script_label: str = Field(default="", max_length=80)
    cta_label: str = Field(default="", max_length=80)
    target_route: str = Field(default="/ai", max_length=240)
    image_key: str | None = Field(default=None, max_length=80)
    image_url: str | None = Field(default=None, max_length=2048)
    sort_order: int = Field(default=0, ge=0)
    starts_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    ends_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )


class HomeShortcut(ContentRecord, table=True):
    __tablename__ = "home_shortcuts"
    __table_args__ = (
        UniqueConstraint("public_id", name="uq_home_shortcuts_public_id"),
    )

    title: str = Field(max_length=80)
    description: str = Field(max_length=240)
    icon: str = Field(max_length=40)
    route: str = Field(max_length=240)
    sort_order: int = Field(default=0, ge=0)


class ContentVersion(SQLModel, table=True):
    __tablename__ = "content_versions"
    __table_args__ = (
        UniqueConstraint(
            "content_type",
            "content_id",
            "version_no",
            name="uq_content_versions_number",
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    content_type: ContentType = Field(
        sa_column=Column(
            Enum(ContentType, name="content_type"),
            nullable=False,
            index=True,
        ),
    )
    content_id: uuid.UUID = Field(index=True)
    version_no: int = Field(ge=1)
    snapshot: dict[str, object] = Field(sa_column=json_column())
    action: ContentAction = Field(
        default=ContentAction.CREATE,
        sa_column=Column(
            Enum(ContentAction, name="content_action"),
            nullable=False,
        ),
    )
    created_by_admin_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="users.id",
        ondelete="SET NULL",
        index=True,
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )
