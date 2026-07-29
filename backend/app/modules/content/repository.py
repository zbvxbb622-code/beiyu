from collections.abc import Sequence
from typing import Any, cast, overload
from uuid import UUID

from sqlalchemy import String, func, or_
from sqlalchemy import cast as sql_cast
from sqlalchemy.orm import InstrumentedAttribute
from sqlmodel import Session, select

from app.db.models import (
    Bar,
    ContentStatus,
    DrinkKnowledgeEntry,
    HomeBanner,
    HomeShortcut,
    Ingredient,
    Recipe,
    RecipeIngredient,
)
from app.db.models.accounts import utc_now


def column[FieldType](value: FieldType) -> InstrumentedAttribute[FieldType]:
    return cast("InstrumentedAttribute[FieldType]", value)


@overload
def list_published(
    session: Session,
    *,
    model: type[Ingredient],
    page: int,
    page_size: int,
) -> tuple[Sequence[Ingredient], int]: ...


@overload
def list_published(
    session: Session,
    *,
    model: type[Recipe],
    page: int,
    page_size: int,
) -> tuple[Sequence[Recipe], int]: ...


@overload
def list_published(
    session: Session,
    *,
    model: type[Bar],
    page: int,
    page_size: int,
) -> tuple[Sequence[Bar], int]: ...


@overload
def list_published(
    session: Session,
    *,
    model: type[DrinkKnowledgeEntry],
    page: int,
    page_size: int,
) -> tuple[Sequence[DrinkKnowledgeEntry], int]: ...


def list_published(
    session: Session,
    *,
    model: Any,
    page: int,
    page_size: int,
) -> tuple[Sequence[Any], int]:
    total = session.exec(
        select(func.count())
        .select_from(model)
        .where(model.status == ContentStatus.PUBLISHED)
    ).one()
    items = session.exec(
        select(model)
        .where(model.status == ContentStatus.PUBLISHED)
        .order_by(column(model.public_id).asc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    return items, total


@overload
def get_published(
    session: Session,
    *,
    model: type[Recipe],
    public_id: str,
) -> Recipe | None: ...


@overload
def get_published(
    session: Session,
    *,
    model: type[Bar],
    public_id: str,
) -> Bar | None: ...


@overload
def get_published(
    session: Session,
    *,
    model: type[DrinkKnowledgeEntry],
    public_id: str,
) -> DrinkKnowledgeEntry | None: ...


def get_published(
    session: Session,
    *,
    model: Any,
    public_id: str,
) -> Any | None:
    return session.exec(
        select(model).where(
            model.public_id == public_id,
            model.status == ContentStatus.PUBLISHED,
        )
    ).first()


def list_recipe_ingredients(
    session: Session,
    *,
    recipe_id: UUID,
) -> list[tuple[RecipeIngredient, Ingredient]]:
    rows = session.exec(
        select(RecipeIngredient, Ingredient)
        .join(
            Ingredient,
            column(RecipeIngredient.ingredient_id) == column(Ingredient.id),
        )
        .where(RecipeIngredient.recipe_id == recipe_id)
        .order_by(column(RecipeIngredient.sort_order).asc())
    ).all()
    return [(row[0], row[1]) for row in rows]


def get_recipe_public_id(
    session: Session,
    *,
    recipe_id: UUID | None,
) -> str | None:
    if recipe_id is None:
        return None
    recipe = session.get(Recipe, recipe_id)
    return recipe.public_id if recipe is not None else None


def list_active_banners(session: Session) -> Sequence[HomeBanner]:
    now = utc_now()
    starts_at = column(HomeBanner.starts_at)
    ends_at = column(HomeBanner.ends_at)
    return session.exec(
        select(HomeBanner)
        .where(
            HomeBanner.status == ContentStatus.PUBLISHED,
            or_(starts_at.is_(None), starts_at <= now),
            or_(ends_at.is_(None), ends_at > now),
        )
        .order_by(
            column(HomeBanner.sort_order).asc(),
            column(HomeBanner.public_id).asc(),
        )
    ).all()


def list_active_shortcuts(session: Session) -> Sequence[HomeShortcut]:
    return session.exec(
        select(HomeShortcut)
        .where(HomeShortcut.status == ContentStatus.PUBLISHED)
        .order_by(
            column(HomeShortcut.sort_order).asc(),
            column(HomeShortcut.public_id).asc(),
        )
    ).all()


def _search_pattern(query: str) -> str:
    escaped = query.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def search_recipes(session: Session, *, query: str) -> Sequence[Recipe]:
    pattern = _search_pattern(query)
    return session.exec(
        select(Recipe)
        .where(
            Recipe.status == ContentStatus.PUBLISHED,
            or_(
                column(Recipe.name).ilike(pattern, escape="\\"),
                column(Recipe.english_name).ilike(pattern, escape="\\"),
                column(Recipe.description).ilike(pattern, escape="\\"),
                sql_cast(column(Recipe.tags), String).ilike(pattern, escape="\\"),
            ),
        )
        .order_by(column(Recipe.public_id).asc())
    ).all()


def search_bars(session: Session, *, query: str) -> Sequence[Bar]:
    pattern = _search_pattern(query)
    return session.exec(
        select(Bar)
        .where(
            Bar.status == ContentStatus.PUBLISHED,
            or_(
                column(Bar.name).ilike(pattern, escape="\\"),
                column(Bar.address).ilike(pattern, escape="\\"),
                column(Bar.description).ilike(pattern, escape="\\"),
                sql_cast(column(Bar.tags), String).ilike(pattern, escape="\\"),
            ),
        )
        .order_by(column(Bar.public_id).asc())
    ).all()


def search_knowledge(
    session: Session,
    *,
    query: str,
) -> Sequence[DrinkKnowledgeEntry]:
    pattern = _search_pattern(query)
    return session.exec(
        select(DrinkKnowledgeEntry)
        .where(
            DrinkKnowledgeEntry.status == ContentStatus.PUBLISHED,
            or_(
                column(DrinkKnowledgeEntry.name).ilike(pattern, escape="\\"),
                column(DrinkKnowledgeEntry.english_name).ilike(
                    pattern,
                    escape="\\",
                ),
                column(DrinkKnowledgeEntry.meaning).ilike(pattern, escape="\\"),
                column(DrinkKnowledgeEntry.story).ilike(pattern, escape="\\"),
                sql_cast(column(DrinkKnowledgeEntry.symbols), String).ilike(
                    pattern,
                    escape="\\",
                ),
            ),
        )
        .order_by(column(DrinkKnowledgeEntry.public_id).asc())
    ).all()
