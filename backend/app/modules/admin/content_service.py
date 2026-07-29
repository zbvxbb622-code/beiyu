from typing import Any, cast

from sqlalchemy.orm import InstrumentedAttribute
from sqlmodel import Session, select

from app.core.errors import AppError
from app.db.models import (
    ContentAction,
    ContentStatus,
    ContentType,
    ContentVersion,
    Ingredient,
    Recipe,
    RecipeIngredient,
    User,
)
from app.db.models.accounts import utc_now
from app.modules.content.schemas import (
    AdminRecipeResponse,
    ContentVersionListResponse,
    ContentVersionResponse,
    RecipeCreate,
    RecipeIngredientWrite,
    RecipePatch,
)
from app.modules.content.service import recipe_response


def _column[FieldType](value: FieldType) -> InstrumentedAttribute[FieldType]:
    return cast("InstrumentedAttribute[FieldType]", value)


def _content_not_found() -> AppError:
    return AppError(
        code="CONTENT_NOT_FOUND",
        message="内容不存在",
        status_code=404,
    )


def _revision_conflict(*, current_revision: int) -> AppError:
    return AppError(
        code="CONTENT_REVISION_CONFLICT",
        message="内容已更新，请刷新后重试",
        status_code=409,
        details={"currentRevision": current_revision},
    )


def _get_recipe(session: Session, public_id: str) -> Recipe:
    recipe = session.exec(
        select(Recipe)
        .where(Recipe.public_id == public_id)
        .with_for_update()
    ).first()
    if recipe is None:
        raise _content_not_found()
    return recipe


def _ingredient_records(
    session: Session,
    ingredients: list[RecipeIngredientWrite],
) -> dict[str, Ingredient]:
    public_ids = [item.id for item in ingredients]
    records = session.exec(
        select(Ingredient).where(_column(Ingredient.public_id).in_(public_ids))
    ).all()
    by_public_id = {item.public_id: item for item in records}
    missing = [public_id for public_id in public_ids if public_id not in by_public_id]
    if missing:
        raise AppError(
            code="UNKNOWN_INGREDIENT",
            message="酒谱包含不存在的配料",
            status_code=422,
            details={"ingredientIds": missing},
        )
    return by_public_id


def _replace_recipe_ingredients(
    session: Session,
    *,
    recipe: Recipe,
    ingredients: list[RecipeIngredientWrite],
) -> None:
    records = _ingredient_records(session, ingredients)
    old_links = session.exec(
        select(RecipeIngredient).where(RecipeIngredient.recipe_id == recipe.id)
    ).all()
    for link in old_links:
        session.delete(link)
    session.flush()
    for sort_order, ingredient in enumerate(ingredients):
        session.add(
            RecipeIngredient(
                recipe_id=recipe.id,
                ingredient_id=records[ingredient.id].id,
                amount=ingredient.amount,
                sort_order=sort_order,
            )
        )


def _admin_recipe_response(
    session: Session,
    recipe: Recipe,
) -> AdminRecipeResponse:
    return AdminRecipeResponse(
        **recipe_response(session, recipe).model_dump(),
        status=recipe.status.value,
        revision=recipe.revision,
    )


def _recipe_snapshot(session: Session, recipe: Recipe) -> dict[str, Any]:
    return _admin_recipe_response(session, recipe).model_dump(
        mode="json",
        by_alias=True,
    )


def _add_recipe_version(
    session: Session,
    *,
    recipe: Recipe,
    admin: User,
    action: ContentAction,
) -> None:
    session.flush()
    session.add(
        ContentVersion(
            content_type=ContentType.RECIPE,
            content_id=recipe.id,
            version_no=recipe.revision,
            snapshot=_recipe_snapshot(session, recipe),
            action=action,
            created_by_admin_id=admin.id,
        )
    )


def create_recipe(
    session: Session,
    *,
    payload: RecipeCreate,
    admin: User,
) -> AdminRecipeResponse:
    existing = session.exec(
        select(Recipe).where(Recipe.public_id == payload.public_id)
    ).first()
    if existing is not None:
        raise AppError(
            code="CONTENT_ID_EXISTS",
            message="内容编号已存在",
            status_code=409,
        )
    _ingredient_records(session, payload.ingredients)
    now = utc_now()
    recipe = Recipe(
        public_id=payload.public_id,
        name=payload.name,
        english_name=payload.english_name,
        description=payload.description,
        tags=payload.tags,
        steps=payload.steps,
        image_key=payload.image_key,
        image_url=payload.image_url,
        difficulty=payload.difficulty,
        prep_minutes=payload.prep_minutes,
        status=ContentStatus.DRAFT,
        revision=1,
        published_at=None,
        created_at=now,
        updated_at=now,
    )
    session.add(recipe)
    session.flush()
    _replace_recipe_ingredients(
        session,
        recipe=recipe,
        ingredients=payload.ingredients,
    )
    _add_recipe_version(
        session,
        recipe=recipe,
        admin=admin,
        action=ContentAction.CREATE,
    )
    session.commit()
    session.refresh(recipe)
    return _admin_recipe_response(session, recipe)


def patch_recipe(
    session: Session,
    *,
    public_id: str,
    payload: RecipePatch,
    admin: User,
) -> AdminRecipeResponse:
    recipe = _get_recipe(session, public_id)
    if recipe.revision != payload.expected_revision:
        raise _revision_conflict(current_revision=recipe.revision)

    ingredients = (
        payload.ingredients if "ingredients" in payload.model_fields_set else None
    )
    patch = payload.model_dump(exclude_unset=True, by_alias=False)
    patch.pop("expected_revision")
    patch.pop("ingredients", None)
    for field, value in patch.items():
        if value is None and field not in {"image_key", "image_url"}:
            raise AppError(
                code="INVALID_CONTENT_PATCH",
                message=f"{field} 不能为空",
                status_code=422,
            )
        setattr(recipe, field, value)
    if ingredients is not None:
        _replace_recipe_ingredients(
            session,
            recipe=recipe,
            ingredients=ingredients,
        )
    recipe.status = ContentStatus.DRAFT
    recipe.published_at = None
    recipe.revision += 1
    recipe.updated_at = utc_now()
    session.add(recipe)
    _add_recipe_version(
        session,
        recipe=recipe,
        admin=admin,
        action=ContentAction.UPDATE,
    )
    session.commit()
    session.refresh(recipe)
    return _admin_recipe_response(session, recipe)


def transition_recipe(
    session: Session,
    *,
    public_id: str,
    expected_revision: int,
    admin: User,
    target_status: ContentStatus,
) -> AdminRecipeResponse:
    recipe = _get_recipe(session, public_id)
    if recipe.revision != expected_revision:
        raise _revision_conflict(current_revision=recipe.revision)
    if target_status is ContentStatus.PUBLISHED:
        if not recipe.image_key and not recipe.image_url:
            raise AppError(
                code="CONTENT_IMAGE_REQUIRED",
                message="发布前需要配置图片",
                status_code=422,
            )
        if not session.exec(
            select(RecipeIngredient).where(
                RecipeIngredient.recipe_id == recipe.id
            )
        ).first():
            raise AppError(
                code="RECIPE_INGREDIENTS_REQUIRED",
                message="发布前至少需要一个配料",
                status_code=422,
            )
    recipe.status = target_status
    recipe.revision += 1
    recipe.updated_at = utc_now()
    recipe.published_at = (
        recipe.updated_at if target_status is ContentStatus.PUBLISHED else None
    )
    session.add(recipe)
    _add_recipe_version(
        session,
        recipe=recipe,
        admin=admin,
        action=(
            ContentAction.PUBLISH
            if target_status is ContentStatus.PUBLISHED
            else ContentAction.ARCHIVE
        ),
    )
    session.commit()
    session.refresh(recipe)
    return _admin_recipe_response(session, recipe)


def list_recipe_versions(
    session: Session,
    *,
    public_id: str,
) -> ContentVersionListResponse:
    recipe = _get_recipe(session, public_id)
    versions = session.exec(
        select(ContentVersion)
        .where(
            ContentVersion.content_type == ContentType.RECIPE,
            ContentVersion.content_id == recipe.id,
        )
        .order_by(_column(ContentVersion.version_no).desc())
    ).all()
    return ContentVersionListResponse(
        items=[
            ContentVersionResponse(
                version_no=version.version_no,
                action=version.action.value,
                snapshot=version.snapshot,
                created_at=version.created_at,
            )
            for version in versions
        ]
    )


def rollback_recipe(
    session: Session,
    *,
    public_id: str,
    expected_revision: int,
    version_no: int,
    admin: User,
) -> AdminRecipeResponse:
    recipe = _get_recipe(session, public_id)
    if recipe.revision != expected_revision:
        raise _revision_conflict(current_revision=recipe.revision)
    version = session.exec(
        select(ContentVersion).where(
            ContentVersion.content_type == ContentType.RECIPE,
            ContentVersion.content_id == recipe.id,
            ContentVersion.version_no == version_no,
        )
    ).first()
    if version is None:
        raise AppError(
            code="CONTENT_VERSION_NOT_FOUND",
            message="内容版本不存在",
            status_code=404,
        )
    restored = RecipeCreate.model_validate(version.snapshot)
    recipe.name = restored.name
    recipe.english_name = restored.english_name
    recipe.description = restored.description
    recipe.tags = restored.tags
    recipe.steps = restored.steps
    recipe.image_key = restored.image_key
    recipe.image_url = restored.image_url
    recipe.difficulty = restored.difficulty
    recipe.prep_minutes = restored.prep_minutes
    _replace_recipe_ingredients(
        session,
        recipe=recipe,
        ingredients=restored.ingredients,
    )
    recipe.status = ContentStatus.DRAFT
    recipe.published_at = None
    recipe.revision += 1
    recipe.updated_at = utc_now()
    session.add(recipe)
    _add_recipe_version(
        session,
        recipe=recipe,
        admin=admin,
        action=ContentAction.ROLLBACK,
    )
    session.commit()
    session.refresh(recipe)
    return _admin_recipe_response(session, recipe)
