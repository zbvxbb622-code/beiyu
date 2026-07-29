from datetime import timedelta

from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import ContentStatus, HomeBanner, Recipe
from app.db.models.accounts import utc_now
from app.modules.content.seed import seed_content


def test_recipe_list_is_paginated_and_matches_mobile_contract(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)

    response = database_client.get("/api/v1/recipes?page=1&pageSize=5")

    assert response.status_code == 200
    payload = response.json()
    assert len(payload["items"]) == 5
    assert payload["pagination"] == {
        "page": 1,
        "pageSize": 5,
        "totalItems": 23,
        "totalPages": 5,
    }
    first = payload["items"][0]
    assert set(first) >= {
        "id",
        "name",
        "englishName",
        "description",
        "tags",
        "ingredients",
        "steps",
        "imageKey",
        "difficulty",
        "prepMinutes",
    }
    assert set(first["ingredients"][0]) >= {"id", "name", "category", "amount"}


def test_recipe_detail_hides_archived_content(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)
    margarita = database_session.exec(
        select(Recipe).where(Recipe.public_id == "classic-margarita")
    ).one()
    margarita.status = ContentStatus.ARCHIVED
    database_session.add(margarita)
    database_session.commit()

    detail = database_client.get("/api/v1/recipes/classic-margarita")
    listing = database_client.get("/api/v1/recipes?pageSize=100")

    assert detail.status_code == 404
    assert detail.json()["error"]["code"] == "CONTENT_NOT_FOUND"
    assert "classic-margarita" not in {
        item["id"] for item in listing.json()["items"]
    }


def test_home_preserves_banner_and_shortcut_order(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)

    response = database_client.get("/api/v1/home")

    assert response.status_code == 200
    payload = response.json()
    assert [item["id"] for item in payload["banners"]] == [
        "welcome-bar",
        "spark-night",
        "classic-counter",
        "neon-party",
    ]
    assert [item["id"] for item in payload["shortcuts"]] == [
        "blind-box",
        "drink-knowledge",
        "classic-series",
        "shared-cellar",
    ]
    assert payload["banners"][0]["targetRoute"] == "/ai"


def test_home_only_returns_banners_inside_their_schedule(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)
    now = utc_now()
    expired = database_session.exec(
        select(HomeBanner).where(HomeBanner.public_id == "welcome-bar")
    ).one()
    expired.ends_at = now - timedelta(minutes=1)
    upcoming = database_session.exec(
        select(HomeBanner).where(HomeBanner.public_id == "spark-night")
    ).one()
    upcoming.starts_at = now + timedelta(minutes=1)
    database_session.add(expired)
    database_session.add(upcoming)
    database_session.commit()

    response = database_client.get("/api/v1/home")

    assert response.status_code == 200
    assert [item["id"] for item in response.json()["banners"]] == [
        "classic-counter",
        "neon-party",
    ]


def test_ingredient_bar_and_knowledge_endpoints_map_editorial_fields(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)

    ingredients = database_client.get("/api/v1/ingredients")
    bar = database_client.get("/api/v1/bars/amor-fati")
    knowledge = database_client.get("/api/v1/knowledge/k-margarita")

    assert ingredients.status_code == 200
    assert ingredients.json()["items"][0] == {
        "id": "aperol",
        "name": "阿佩罗",
        "category": "liqueur",
    }
    assert bar.status_code == 200
    assert bar.json()["id"] == "amor-fati"
    assert bar.json()["menu"][0]["id"] == "lemon-bubble"
    assert bar.json()["reviews"][0]["authorName"] == "Alice"
    assert knowledge.status_code == 200
    assert knowledge.json()["recipeId"] == "classic-margarita"
    assert knowledge.json()["symbols"] == ["纪念", "雏菊", "爱与思念"]
