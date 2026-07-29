from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import ContentStatus, Recipe
from app.modules.content.seed import seed_content


def test_search_supports_single_chinese_character_and_case_insensitive_english(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)

    chinese = database_client.get("/api/v1/search?q=玛")
    english = database_client.get("/api/v1/search?q=mArGaRiTa")

    assert chinese.status_code == 200
    assert english.status_code == 200
    assert any(item["id"] == "classic-margarita" for item in chinese.json()["items"])
    assert any(item["id"] == "classic-margarita" for item in english.json()["items"])


def test_search_excludes_archived_content(
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

    response = database_client.get("/api/v1/search?q=Margarita")

    assert response.status_code == 200
    assert {
        (item["type"], item["id"]) for item in response.json()["items"]
    } == {("knowledge", "k-margarita")}


def test_search_results_have_stable_type_and_id_order(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)

    first = database_client.get("/api/v1/search?q=酒&pageSize=100").json()["items"]
    second = database_client.get("/api/v1/search?q=酒&pageSize=100").json()["items"]

    assert first == second
    type_order = {"recipe": 0, "bar": 1, "knowledge": 2}
    assert [(type_order[item["type"]], item["id"]) for item in first] == sorted(
        (type_order[item["type"]], item["id"]) for item in first
    )
