import json
import shutil

import pytest
from sqlmodel import Session, func, select

from app.db.models import ContentStatus, Ingredient, Recipe
from app.modules.content.seed import DEFAULT_SEED_DIR, seed_content


def test_seed_content_is_idempotent_and_publishes_bundled_content(
    database_session: Session,
) -> None:
    first = seed_content(database_session)
    second = seed_content(database_session)

    assert first.created > 0
    assert first.updated == 0
    assert first.skipped == 0
    assert second.created == 0
    assert second.updated == 0
    assert second.skipped == first.created

    margarita = database_session.exec(
        select(Recipe).where(Recipe.public_id == "classic-margarita")
    ).one()
    assert margarita.name == "玛格丽特"
    assert margarita.status is ContentStatus.PUBLISHED
    assert margarita.image_key == "margarita"


def test_seed_content_preserves_manual_changes_unless_update_is_explicit(
    database_session: Session,
) -> None:
    seed_content(database_session)
    margarita = database_session.exec(
        select(Recipe).where(Recipe.public_id == "classic-margarita")
    ).one()
    margarita.name = "人工修改的名称"
    database_session.add(margarita)
    database_session.commit()

    skipped = seed_content(database_session)
    database_session.refresh(margarita)
    assert skipped.updated == 0
    assert margarita.name == "人工修改的名称"

    updated = seed_content(database_session, update_existing=True)
    database_session.refresh(margarita)
    assert updated.updated > 0
    assert margarita.name == "玛格丽特"


def test_invalid_seed_rolls_back_the_whole_import(
    database_session: Session,
    tmp_path,
) -> None:
    invalid_seed_dir = tmp_path / "content"
    shutil.copytree(DEFAULT_SEED_DIR, invalid_seed_dir)
    recipes_path = invalid_seed_dir / "recipes.json"
    recipes = json.loads(recipes_path.read_text(encoding="utf-8"))
    recipes[0]["ingredients"][0]["id"] = "missing-ingredient"
    recipes_path.write_text(
        json.dumps(recipes, ensure_ascii=False),
        encoding="utf-8",
    )

    with pytest.raises(ValueError, match="missing-ingredient"):
        seed_content(database_session, seed_dir=invalid_seed_dir)

    assert database_session.exec(select(func.count()).select_from(Ingredient)).one() == 0
    assert database_session.exec(select(func.count()).select_from(Recipe)).one() == 0
