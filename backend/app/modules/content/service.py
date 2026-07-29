import math

from sqlmodel import Session

from app.core.errors import AppError
from app.db.models import (
    Bar,
    DrinkKnowledgeEntry,
    Ingredient,
    Recipe,
)
from app.modules.content.repository import (
    get_published,
    get_recipe_public_id,
    list_active_banners,
    list_active_shortcuts,
    list_published,
    list_recipe_ingredients,
    search_bars,
    search_knowledge,
    search_recipes,
)
from app.modules.content.schemas import (
    BarListResponse,
    BarMenuItemResponse,
    BarResponse,
    BarReviewResponse,
    CocktailIngredientResponse,
    HeroSlideResponse,
    HomeResponse,
    HomeShortcutResponse,
    IngredientListResponse,
    IngredientResponse,
    KnowledgeListResponse,
    KnowledgeResponse,
    PaginationResponse,
    RecipeListResponse,
    RecipeResponse,
    SearchListResponse,
    SearchResultResponse,
)


def _pagination(*, page: int, page_size: int, total: int) -> PaginationResponse:
    return PaginationResponse(
        page=page,
        page_size=page_size,
        total_items=total,
        total_pages=math.ceil(total / page_size) if total else 0,
    )


def _not_found() -> AppError:
    return AppError(
        code="CONTENT_NOT_FOUND",
        message="内容不存在或尚未发布",
        status_code=404,
    )


def ingredient_response(ingredient: Ingredient) -> IngredientResponse:
    return IngredientResponse(
        id=ingredient.public_id,
        name=ingredient.name,
        category=ingredient.category.value,
    )


def recipe_response(session: Session, recipe: Recipe) -> RecipeResponse:
    ingredients = [
        CocktailIngredientResponse(
            id=ingredient.public_id,
            name=ingredient.name,
            category=ingredient.category.value,
            amount=link.amount,
        )
        for link, ingredient in list_recipe_ingredients(session, recipe_id=recipe.id)
    ]
    return RecipeResponse(
        id=recipe.public_id,
        name=recipe.name,
        english_name=recipe.english_name,
        description=recipe.description,
        tags=recipe.tags,
        ingredients=ingredients,
        steps=recipe.steps,
        image_key=recipe.image_key or "",
        image_url=recipe.image_url,
        difficulty=recipe.difficulty,
        prep_minutes=recipe.prep_minutes,
    )


def bar_response(bar: Bar) -> BarResponse:
    return BarResponse(
        id=bar.public_id,
        name=bar.name,
        image_key=bar.image_key or "",
        image_url=bar.image_url,
        rating=bar.rating,
        review_count=bar.review_count,
        average_spend=bar.average_spend,
        distance_label=bar.distance_label,
        metro_hint=bar.metro_hint,
        address=bar.address,
        open_hours=bar.open_hours,
        description=bar.description,
        tags=bar.tags,
        taste_score=bar.taste_score,
        environment_score=bar.environment_score,
        service_score=bar.service_score,
        phone=bar.phone,
        menu=[BarMenuItemResponse.model_validate(item) for item in bar.menu],
        reviews=[
            BarReviewResponse.model_validate(item) for item in bar.featured_reviews
        ],
    )


def knowledge_response(
    session: Session,
    entry: DrinkKnowledgeEntry,
) -> KnowledgeResponse:
    return KnowledgeResponse(
        id=entry.public_id,
        recipe_id=get_recipe_public_id(session, recipe_id=entry.recipe_id),
        name=entry.name,
        english_name=entry.english_name,
        image_key=entry.image_key or "",
        image_url=entry.image_url,
        era=entry.era,
        meaning=entry.meaning,
        story=entry.story,
        symbols=entry.symbols,
    )


def list_ingredients(
    session: Session,
    *,
    page: int,
    page_size: int,
) -> IngredientListResponse:
    items, total = list_published(
        session,
        model=Ingredient,
        page=page,
        page_size=page_size,
    )
    return IngredientListResponse(
        items=[ingredient_response(item) for item in items],
        pagination=_pagination(page=page, page_size=page_size, total=total),
    )


def list_recipes(
    session: Session,
    *,
    page: int,
    page_size: int,
) -> RecipeListResponse:
    items, total = list_published(
        session,
        model=Recipe,
        page=page,
        page_size=page_size,
    )
    return RecipeListResponse(
        items=[recipe_response(session, item) for item in items],
        pagination=_pagination(page=page, page_size=page_size, total=total),
    )


def get_recipe(session: Session, public_id: str) -> RecipeResponse:
    recipe = get_published(session, model=Recipe, public_id=public_id)
    if recipe is None:
        raise _not_found()
    return recipe_response(session, recipe)


def list_bars(
    session: Session,
    *,
    page: int,
    page_size: int,
) -> BarListResponse:
    items, total = list_published(
        session,
        model=Bar,
        page=page,
        page_size=page_size,
    )
    return BarListResponse(
        items=[bar_response(item) for item in items],
        pagination=_pagination(page=page, page_size=page_size, total=total),
    )


def get_bar(session: Session, public_id: str) -> BarResponse:
    bar = get_published(session, model=Bar, public_id=public_id)
    if bar is None:
        raise _not_found()
    return bar_response(bar)


def list_knowledge(
    session: Session,
    *,
    page: int,
    page_size: int,
) -> KnowledgeListResponse:
    items, total = list_published(
        session,
        model=DrinkKnowledgeEntry,
        page=page,
        page_size=page_size,
    )
    return KnowledgeListResponse(
        items=[knowledge_response(session, item) for item in items],
        pagination=_pagination(page=page, page_size=page_size, total=total),
    )


def get_knowledge(session: Session, public_id: str) -> KnowledgeResponse:
    entry = get_published(
        session,
        model=DrinkKnowledgeEntry,
        public_id=public_id,
    )
    if entry is None:
        raise _not_found()
    return knowledge_response(session, entry)


def get_home(session: Session) -> HomeResponse:
    banners = [
        HeroSlideResponse(
            id=item.public_id,
            brand=item.brand,
            title=item.title,
            subtitle=item.subtitle,
            script_label=item.script_label,
            cta_label=item.cta_label,
            image_key=item.image_key or "",
            image_url=item.image_url,
            target_route=item.target_route,
        )
        for item in list_active_banners(session)
    ]
    shortcuts = [
        HomeShortcutResponse(
            id=item.public_id,
            title=item.title,
            description=item.description,
            icon=item.icon,
            route=item.route,
        )
        for item in list_active_shortcuts(session)
    ]
    recipes, _ = list_published(
        session,
        model=Recipe,
        page=1,
        page_size=6,
    )
    bars, _ = list_published(
        session,
        model=Bar,
        page=1,
        page_size=4,
    )
    return HomeResponse(
        banners=banners,
        shortcuts=shortcuts,
        featured_recipes=[recipe_response(session, item) for item in recipes],
        featured_bars=[bar_response(item) for item in bars],
    )


def search_content(
    session: Session,
    *,
    query: str,
    page: int,
    page_size: int,
) -> SearchListResponse:
    items = [
        *[
            SearchResultResponse(
                type="recipe",
                id=item.public_id,
                title=item.name,
                subtitle=item.description,
                image_key=item.image_key or "",
                image_url=item.image_url,
            )
            for item in search_recipes(session, query=query)
        ],
        *[
            SearchResultResponse(
                type="bar",
                id=item.public_id,
                title=item.name,
                subtitle=item.address,
                image_key=item.image_key or "",
                image_url=item.image_url,
            )
            for item in search_bars(session, query=query)
        ],
        *[
            SearchResultResponse(
                type="knowledge",
                id=item.public_id,
                title=item.name,
                subtitle=item.meaning,
                image_key=item.image_key or "",
                image_url=item.image_url,
            )
            for item in search_knowledge(session, query=query)
        ],
    ]
    total = len(items)
    offset = (page - 1) * page_size
    return SearchListResponse(
        items=items[offset : offset + page_size],
        pagination=_pagination(page=page, page_size=page_size, total=total),
    )
