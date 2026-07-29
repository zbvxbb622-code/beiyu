from datetime import UTC
from typing import cast

from sqlalchemy import Table, UniqueConstraint

from app.db.models.content import (
    Bar,
    ContentAction,
    ContentStatus,
    ContentType,
    ContentVersion,
    DrinkKnowledgeEntry,
    HomeBanner,
    HomeShortcut,
    Ingredient,
    Recipe,
    RecipeIngredient,
)


def model_table(model: type[object]) -> Table:
    return cast(Table, vars(model)["__table__"])


def test_content_models_use_expected_tables_and_defaults() -> None:
    recipe = Recipe(
        public_id="classic-margarita",
        name="玛格丽特",
        english_name="Margarita",
        description="酸甜平衡",
        steps=["摇和"],
    )

    assert Ingredient.__tablename__ == "ingredients"
    assert Recipe.__tablename__ == "recipes"
    assert RecipeIngredient.__tablename__ == "recipe_ingredients"
    assert Bar.__tablename__ == "bars"
    assert DrinkKnowledgeEntry.__tablename__ == "drink_knowledge_entries"
    assert HomeBanner.__tablename__ == "home_banners"
    assert HomeShortcut.__tablename__ == "home_shortcuts"
    assert ContentVersion.__tablename__ == "content_versions"
    assert recipe.status is ContentStatus.DRAFT
    assert recipe.revision == 1
    assert recipe.tags == []
    assert recipe.created_at.tzinfo is UTC


def test_public_content_ids_are_unique() -> None:
    for model in (
        Ingredient,
        Recipe,
        Bar,
        DrinkKnowledgeEntry,
        HomeBanner,
        HomeShortcut,
    ):
        constraints = set(model_table(model).constraints)
        assert any(
            isinstance(constraint, UniqueConstraint)
            and tuple(constraint.columns.keys()) == ("public_id",)
            for constraint in constraints
        )


def test_recipe_ingredient_pair_and_content_version_are_unique() -> None:
    recipe_ingredient_constraints = set(model_table(RecipeIngredient).constraints)
    version_constraints = set(model_table(ContentVersion).constraints)

    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys()) == ("recipe_id", "ingredient_id")
        for constraint in recipe_ingredient_constraints
    )
    assert any(
        isinstance(constraint, UniqueConstraint)
        and tuple(constraint.columns.keys())
        == ("content_type", "content_id", "version_no")
        for constraint in version_constraints
    )


def test_content_version_defaults_capture_audit_action() -> None:
    version = ContentVersion(
        content_type=ContentType.RECIPE,
        content_id=Recipe(
            public_id="gin-tonic",
            name="金汤力",
            english_name="Gin & Tonic",
            description="清爽",
            steps=["加冰"],
        ).id,
        version_no=1,
        snapshot={"name": "金汤力"},
    )

    assert version.action is ContentAction.CREATE
    assert version.created_at.tzinfo is UTC
