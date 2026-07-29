from sqlmodel import Session
from starlette.testclient import TestClient

from app.db.models import UserRole
from app.modules.content.seed import seed_content
from tests.api.test_admin_content_auth import set_current_user_role
from tests.api.test_auth_sessions import bearer, create_login


def editor_headers(client: TestClient, session: Session) -> dict[str, str]:
    login = create_login(client)
    set_current_user_role(session, UserRole.EDITOR)
    return bearer(login["accessToken"])


def recipe_payload() -> dict[str, object]:
    return {
        "id": "stage-two-spritz",
        "name": "二阶段气泡",
        "englishName": "Stage Two Spritz",
        "description": "用于验证内容发布流程",
        "tags": ["清爽", "测试"],
        "ingredients": [
            {"id": "gin", "amount": "30 ml"},
            {"id": "soda-water", "amount": "90 ml"},
        ],
        "steps": ["杯中加冰。", "依次加入材料并轻轻搅拌。"],
        "imageKey": "ginTonic",
        "difficulty": "入门",
        "prepMinutes": 3,
    }


def test_recipe_draft_update_publish_and_archive_lifecycle(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)
    headers = editor_headers(database_client, database_session)

    created = database_client.post(
        "/api/v1/admin/recipes",
        headers=headers,
        json=recipe_payload(),
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "DRAFT"
    assert created.json()["revision"] == 1
    assert (
        database_client.get("/api/v1/recipes/stage-two-spritz").status_code == 404
    )

    updated = database_client.patch(
        "/api/v1/admin/recipes/stage-two-spritz",
        headers=headers,
        json={"expectedRevision": 1, "name": "二阶段金汤力"},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["name"] == "二阶段金汤力"
    assert updated.json()["revision"] == 2

    stale = database_client.patch(
        "/api/v1/admin/recipes/stage-two-spritz",
        headers=headers,
        json={"expectedRevision": 1, "description": "过期修改"},
    )
    assert stale.status_code == 409
    assert stale.json()["error"]["code"] == "CONTENT_REVISION_CONFLICT"

    published = database_client.post(
        "/api/v1/admin/recipes/stage-two-spritz/publish",
        headers=headers,
        json={"expectedRevision": 2},
    )
    assert published.status_code == 200, published.text
    assert published.json()["status"] == "PUBLISHED"
    assert published.json()["revision"] == 3
    assert (
        database_client.get("/api/v1/recipes/stage-two-spritz").status_code == 200
    )

    archived = database_client.post(
        "/api/v1/admin/recipes/stage-two-spritz/archive",
        headers=headers,
        json={"expectedRevision": 3},
    )
    assert archived.status_code == 200, archived.text
    assert archived.json()["status"] == "ARCHIVED"
    assert archived.json()["revision"] == 4
    assert (
        database_client.get("/api/v1/recipes/stage-two-spritz").status_code == 404
    )


def test_recipe_create_rejects_unknown_ingredient(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)
    headers = editor_headers(database_client, database_session)
    payload = recipe_payload()
    payload["ingredients"] = [{"id": "does-not-exist", "amount": "30 ml"}]

    response = database_client.post(
        "/api/v1/admin/recipes",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "UNKNOWN_INGREDIENT"


def test_recipe_patch_can_replace_ingredients(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)
    headers = editor_headers(database_client, database_session)
    created = database_client.post(
        "/api/v1/admin/recipes",
        headers=headers,
        json=recipe_payload(),
    )
    assert created.status_code == 201

    response = database_client.patch(
        "/api/v1/admin/recipes/stage-two-spritz",
        headers=headers,
        json={
            "expectedRevision": 1,
            "ingredients": [{"id": "tonic-water", "amount": "120 ml"}],
        },
    )

    assert response.status_code == 200, response.text
    assert response.json()["ingredients"] == [
        {
            "id": "tonic-water",
            "name": "汤力水",
            "category": "mixer",
            "amount": "120 ml",
        }
    ]
