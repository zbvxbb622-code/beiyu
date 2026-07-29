import json
import uuid
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Literal, Protocol

from pydantic import BaseModel, ConfigDict, TypeAdapter
from pydantic import Field as PydanticField
from pydantic.alias_generators import to_camel
from sqlmodel import Session, select

from app.db.models import (
    Bar,
    ContentAction,
    ContentStatus,
    ContentType,
    ContentVersion,
    DrinkKnowledgeEntry,
    HomeBanner,
    HomeShortcut,
    Ingredient,
    IngredientCategory,
    Recipe,
    RecipeIngredient,
)
from app.db.models.accounts import utc_now

DEFAULT_SEED_DIR = Path(__file__).parents[2] / "seeds" / "content"


class SeedModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="forbid",
    )


class IngredientSeed(SeedModel):
    id: str = PydanticField(min_length=1, max_length=120)
    name: str = PydanticField(min_length=1, max_length=80)
    category: IngredientCategory


class RecipeIngredientSeed(SeedModel):
    id: str = PydanticField(min_length=1, max_length=120)
    amount: str = PydanticField(min_length=1, max_length=80)


class RecipeSeed(SeedModel):
    id: str = PydanticField(min_length=1, max_length=120)
    name: str = PydanticField(min_length=1, max_length=120)
    english_name: str = PydanticField(min_length=1, max_length=160)
    description: str = PydanticField(min_length=1, max_length=2000)
    tags: list[str]
    ingredients: list[RecipeIngredientSeed] = PydanticField(min_length=1)
    steps: list[str] = PydanticField(min_length=1)
    image_key: str = PydanticField(min_length=1, max_length=80)
    difficulty: Literal["入门", "进阶", "专业"]
    prep_minutes: int = PydanticField(ge=0)


class BarMenuSeed(SeedModel):
    id: str = PydanticField(min_length=1, max_length=120)
    name: str = PydanticField(min_length=1, max_length=120)
    image_key: str = PydanticField(min_length=1, max_length=80)
    likes: int = PydanticField(ge=0)
    badge: str | None = PydanticField(default=None, max_length=80)


class BarReviewSeed(SeedModel):
    id: str = PydanticField(min_length=1, max_length=120)
    author_name: str = PydanticField(min_length=1, max_length=120)
    author_avatar_key: str = PydanticField(min_length=1, max_length=80)
    text: str = PydanticField(min_length=1, max_length=2000)
    date: str = PydanticField(min_length=1, max_length=80)
    likes: int = PydanticField(ge=0)
    image_keys: list[str] = PydanticField(default_factory=list)


class BarSeed(SeedModel):
    id: str = PydanticField(min_length=1, max_length=120)
    name: str = PydanticField(min_length=1, max_length=120)
    image_key: str = PydanticField(min_length=1, max_length=80)
    rating: float = PydanticField(ge=0, le=5)
    review_count: int = PydanticField(ge=0)
    average_spend: int = PydanticField(ge=0)
    distance_label: str = PydanticField(max_length=80)
    metro_hint: str = PydanticField(max_length=160)
    address: str = PydanticField(max_length=240)
    open_hours: str = PydanticField(max_length=160)
    description: str = PydanticField(max_length=4000)
    tags: list[str]
    taste_score: float = PydanticField(ge=0, le=5)
    environment_score: float = PydanticField(ge=0, le=5)
    service_score: float = PydanticField(ge=0, le=5)
    phone: str = PydanticField(max_length=40)
    menu: list[BarMenuSeed]
    featured_reviews: list[BarReviewSeed]


class KnowledgeSeed(SeedModel):
    id: str = PydanticField(min_length=1, max_length=120)
    recipe_id: str | None = PydanticField(default=None, max_length=120)
    name: str = PydanticField(min_length=1, max_length=120)
    english_name: str = PydanticField(min_length=1, max_length=160)
    image_key: str = PydanticField(min_length=1, max_length=80)
    era: str = PydanticField(min_length=1, max_length=240)
    meaning: str = PydanticField(min_length=1, max_length=500)
    story: str = PydanticField(min_length=1, max_length=6000)
    symbols: list[str]


class BannerSeed(SeedModel):
    id: str = PydanticField(min_length=1, max_length=120)
    brand: str = PydanticField(min_length=1, max_length=80)
    title: str = PydanticField(min_length=1, max_length=160)
    subtitle: str = PydanticField(min_length=1, max_length=160)
    script_label: str = PydanticField(max_length=80)
    cta_label: str = PydanticField(max_length=80)
    image_key: str = PydanticField(min_length=1, max_length=80)
    target_route: Literal["/ai", "/recipes", "/bars", "/drink-knowledge"]
    sort_order: int = PydanticField(ge=0)


class ShortcutSeed(SeedModel):
    id: str = PydanticField(min_length=1, max_length=120)
    title: str = PydanticField(min_length=1, max_length=80)
    description: str = PydanticField(max_length=240)
    icon: Literal["box", "book", "cards", "cellar"]
    route: Literal["/blind-box", "/drink-knowledge", "/recipes", "/cellar"]
    sort_order: int = PydanticField(ge=0)


class HomeSeed(SeedModel):
    banners: list[BannerSeed]
    shortcuts: list[ShortcutSeed]


@dataclass(frozen=True, slots=True)
class SeedBundle:
    ingredients: list[IngredientSeed]
    recipes: list[RecipeSeed]
    bars: list[BarSeed]
    knowledge: list[KnowledgeSeed]
    home: HomeSeed


@dataclass(frozen=True, slots=True)
class SeedResult:
    created: int
    updated: int
    skipped: int


class SeedContentRecord(Protocol):
    id: uuid.UUID
    revision: int
    status: ContentStatus
    published_at: datetime | None
    updated_at: datetime


def _load_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def _load_seed_bundle(seed_dir: Path) -> SeedBundle:
    bundle = SeedBundle(
        ingredients=TypeAdapter(list[IngredientSeed]).validate_python(
            _load_json(seed_dir / "ingredients.json")
        ),
        recipes=TypeAdapter(list[RecipeSeed]).validate_python(
            _load_json(seed_dir / "recipes.json")
        ),
        bars=TypeAdapter(list[BarSeed]).validate_python(
            _load_json(seed_dir / "bars.json")
        ),
        knowledge=TypeAdapter(list[KnowledgeSeed]).validate_python(
            _load_json(seed_dir / "knowledge.json")
        ),
        home=HomeSeed.model_validate(_load_json(seed_dir / "home.json")),
    )
    ingredient_ids = {item.id for item in bundle.ingredients}
    recipe_ids = {item.id for item in bundle.recipes}
    for recipe in bundle.recipes:
        for ingredient in recipe.ingredients:
            if ingredient.id not in ingredient_ids:
                raise ValueError(
                    f"recipe {recipe.id} references missing ingredient {ingredient.id}"
                )
    for entry in bundle.knowledge:
        if entry.recipe_id is not None and entry.recipe_id not in recipe_ids:
            raise ValueError(
                f"knowledge {entry.id} references missing recipe {entry.recipe_id}"
            )
    return bundle


def _prepare_record(
    record: SeedContentRecord,
    *,
    values: dict[str, Any],
    is_new: bool,
    now: datetime,
) -> None:
    for field, value in values.items():
        setattr(record, field, value)
    if not is_new:
        record.revision += 1
    record.status = ContentStatus.PUBLISHED
    record.published_at = now
    record.updated_at = now


def _add_version(
    session: Session,
    *,
    record: SeedContentRecord,
    content_type: ContentType,
    snapshot: dict[str, Any],
    is_new: bool,
) -> None:
    session.add(
        ContentVersion(
            content_type=content_type,
            content_id=record.id,
            version_no=record.revision,
            snapshot=snapshot,
            action=ContentAction.CREATE if is_new else ContentAction.UPDATE,
        )
    )


def _count(is_new: bool, should_update: bool) -> tuple[int, int, int]:
    if is_new:
        return 1, 0, 0
    if should_update:
        return 0, 1, 0
    return 0, 0, 1


def seed_content(
    session: Session,
    *,
    update_existing: bool = False,
    seed_dir: Path = DEFAULT_SEED_DIR,
) -> SeedResult:
    bundle = _load_seed_bundle(seed_dir)
    created = 0
    updated = 0
    skipped = 0
    now = utc_now()

    try:
        ingredient_records = {
            item.public_id: item for item in session.exec(select(Ingredient)).all()
        }
        for seed in bundle.ingredients:
            record = ingredient_records.get(seed.id)
            is_new = record is None
            if record is None:
                record = Ingredient(
                    public_id=seed.id,
                    name=seed.name,
                    category=seed.category,
                )
                ingredient_records[seed.id] = record
            if is_new or update_existing:
                values = {
                    "name": seed.name,
                    "category": seed.category,
                    "description": None,
                    "image_key": None,
                    "image_url": None,
                }
                _prepare_record(record, values=values, is_new=is_new, now=now)
                session.add(record)
                session.flush()
                _add_version(
                    session,
                    record=record,
                    content_type=ContentType.INGREDIENT,
                    snapshot=seed.model_dump(mode="json", by_alias=True),
                    is_new=is_new,
                )
            delta = _count(is_new, update_existing)
            created += delta[0]
            updated += delta[1]
            skipped += delta[2]

        recipe_records = {
            item.public_id: item for item in session.exec(select(Recipe)).all()
        }
        for seed in bundle.recipes:
            record = recipe_records.get(seed.id)
            is_new = record is None
            if record is None:
                record = Recipe(
                    public_id=seed.id,
                    name=seed.name,
                    english_name=seed.english_name,
                    description=seed.description,
                    steps=seed.steps,
                )
                recipe_records[seed.id] = record
            if is_new or update_existing:
                values = {
                    "name": seed.name,
                    "english_name": seed.english_name,
                    "description": seed.description,
                    "tags": seed.tags,
                    "steps": seed.steps,
                    "image_key": seed.image_key,
                    "image_url": None,
                    "difficulty": seed.difficulty,
                    "prep_minutes": seed.prep_minutes,
                }
                _prepare_record(record, values=values, is_new=is_new, now=now)
                session.add(record)
                session.flush()
                existing_links = session.exec(
                    select(RecipeIngredient).where(
                        RecipeIngredient.recipe_id == record.id
                    )
                ).all()
                for link in existing_links:
                    session.delete(link)
                session.flush()
                for sort_order, ingredient_seed in enumerate(seed.ingredients):
                    session.add(
                        RecipeIngredient(
                            recipe_id=record.id,
                            ingredient_id=ingredient_records[ingredient_seed.id].id,
                            amount=ingredient_seed.amount,
                            sort_order=sort_order,
                        )
                    )
                _add_version(
                    session,
                    record=record,
                    content_type=ContentType.RECIPE,
                    snapshot=seed.model_dump(mode="json", by_alias=True),
                    is_new=is_new,
                )
            delta = _count(is_new, update_existing)
            created += delta[0]
            updated += delta[1]
            skipped += delta[2]

        bar_records = {item.public_id: item for item in session.exec(select(Bar)).all()}
        for seed in bundle.bars:
            record = bar_records.get(seed.id)
            is_new = record is None
            if record is None:
                record = Bar(public_id=seed.id, name=seed.name)
                bar_records[seed.id] = record
            if is_new or update_existing:
                values = {
                    "name": seed.name,
                    "description": seed.description,
                    "image_key": seed.image_key,
                    "image_url": None,
                    "rating": seed.rating,
                    "review_count": seed.review_count,
                    "average_spend": seed.average_spend,
                    "distance_label": seed.distance_label,
                    "metro_hint": seed.metro_hint,
                    "address": seed.address,
                    "open_hours": seed.open_hours,
                    "tags": seed.tags,
                    "taste_score": seed.taste_score,
                    "environment_score": seed.environment_score,
                    "service_score": seed.service_score,
                    "phone": seed.phone,
                    "latitude": None,
                    "longitude": None,
                    "menu": [
                        item.model_dump(mode="json", by_alias=True)
                        for item in seed.menu
                    ],
                    "featured_reviews": [
                        item.model_dump(mode="json", by_alias=True)
                        for item in seed.featured_reviews
                    ],
                }
                _prepare_record(record, values=values, is_new=is_new, now=now)
                session.add(record)
                session.flush()
                _add_version(
                    session,
                    record=record,
                    content_type=ContentType.BAR,
                    snapshot=seed.model_dump(mode="json", by_alias=True),
                    is_new=is_new,
                )
            delta = _count(is_new, update_existing)
            created += delta[0]
            updated += delta[1]
            skipped += delta[2]

        knowledge_records = {
            item.public_id: item
            for item in session.exec(select(DrinkKnowledgeEntry)).all()
        }
        for seed in bundle.knowledge:
            record = knowledge_records.get(seed.id)
            is_new = record is None
            if record is None:
                record = DrinkKnowledgeEntry(
                    public_id=seed.id,
                    name=seed.name,
                    english_name=seed.english_name,
                    era=seed.era,
                    meaning=seed.meaning,
                    story=seed.story,
                )
                knowledge_records[seed.id] = record
            if is_new or update_existing:
                values = {
                    "recipe_id": (
                        recipe_records[seed.recipe_id].id
                        if seed.recipe_id is not None
                        else None
                    ),
                    "name": seed.name,
                    "english_name": seed.english_name,
                    "image_key": seed.image_key,
                    "image_url": None,
                    "era": seed.era,
                    "meaning": seed.meaning,
                    "story": seed.story,
                    "symbols": seed.symbols,
                }
                _prepare_record(record, values=values, is_new=is_new, now=now)
                session.add(record)
                session.flush()
                _add_version(
                    session,
                    record=record,
                    content_type=ContentType.KNOWLEDGE,
                    snapshot=seed.model_dump(mode="json", by_alias=True),
                    is_new=is_new,
                )
            delta = _count(is_new, update_existing)
            created += delta[0]
            updated += delta[1]
            skipped += delta[2]

        banner_records = {
            item.public_id: item for item in session.exec(select(HomeBanner)).all()
        }
        for seed in bundle.home.banners:
            record = banner_records.get(seed.id)
            is_new = record is None
            if record is None:
                record = HomeBanner(
                    public_id=seed.id,
                    brand=seed.brand,
                    title=seed.title,
                    subtitle=seed.subtitle,
                )
                banner_records[seed.id] = record
            if is_new or update_existing:
                values = {
                    "brand": seed.brand,
                    "title": seed.title,
                    "subtitle": seed.subtitle,
                    "script_label": seed.script_label,
                    "cta_label": seed.cta_label,
                    "target_route": seed.target_route,
                    "image_key": seed.image_key,
                    "image_url": None,
                    "sort_order": seed.sort_order,
                    "starts_at": None,
                    "ends_at": None,
                }
                _prepare_record(record, values=values, is_new=is_new, now=now)
                session.add(record)
                session.flush()
                _add_version(
                    session,
                    record=record,
                    content_type=ContentType.BANNER,
                    snapshot=seed.model_dump(mode="json", by_alias=True),
                    is_new=is_new,
                )
            delta = _count(is_new, update_existing)
            created += delta[0]
            updated += delta[1]
            skipped += delta[2]

        shortcut_records = {
            item.public_id: item for item in session.exec(select(HomeShortcut)).all()
        }
        for seed in bundle.home.shortcuts:
            record = shortcut_records.get(seed.id)
            is_new = record is None
            if record is None:
                record = HomeShortcut(
                    public_id=seed.id,
                    title=seed.title,
                    description=seed.description,
                    icon=seed.icon,
                    route=seed.route,
                )
                shortcut_records[seed.id] = record
            if is_new or update_existing:
                values = {
                    "title": seed.title,
                    "description": seed.description,
                    "icon": seed.icon,
                    "route": seed.route,
                    "sort_order": seed.sort_order,
                }
                _prepare_record(record, values=values, is_new=is_new, now=now)
                session.add(record)
                session.flush()
                _add_version(
                    session,
                    record=record,
                    content_type=ContentType.SHORTCUT,
                    snapshot=seed.model_dump(mode="json", by_alias=True),
                    is_new=is_new,
                )
            delta = _count(is_new, update_existing)
            created += delta[0]
            updated += delta[1]
            skipped += delta[2]

        session.commit()
    except Exception:
        session.rollback()
        raise

    return SeedResult(created=created, updated=updated, skipped=skipped)
