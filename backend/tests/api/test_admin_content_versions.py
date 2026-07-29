from sqlmodel import Session
from starlette.testclient import TestClient

from app.modules.content.seed import seed_content
from tests.api.test_admin_content_lifecycle import (
    editor_headers,
    recipe_payload,
)


def test_recipe_versions_are_newest_first_and_rollback_creates_draft(
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
    updated = database_client.patch(
        "/api/v1/admin/recipes/stage-two-spritz",
        headers=headers,
        json={"expectedRevision": 1, "name": "修改后的名称"},
    )
    assert updated.status_code == 200
    published = database_client.post(
        "/api/v1/admin/recipes/stage-two-spritz/publish",
        headers=headers,
        json={"expectedRevision": 2},
    )
    assert published.status_code == 200

    versions = database_client.get(
        "/api/v1/admin/recipes/stage-two-spritz/versions",
        headers=headers,
    )
    assert versions.status_code == 200
    assert [
        (item["versionNo"], item["action"]) for item in versions.json()["items"]
    ] == [(3, "PUBLISH"), (2, "UPDATE"), (1, "CREATE")]
    original_snapshot = versions.json()["items"][-1]["snapshot"]
    assert original_snapshot["name"] == "二阶段气泡"

    rollback = database_client.post(
        "/api/v1/admin/recipes/stage-two-spritz/rollback",
        headers=headers,
        json={"expectedRevision": 3, "versionNo": 1},
    )
    assert rollback.status_code == 200, rollback.text
    assert rollback.json()["name"] == "二阶段气泡"
    assert rollback.json()["status"] == "DRAFT"
    assert rollback.json()["revision"] == 4
    assert (
        database_client.get("/api/v1/recipes/stage-two-spritz").status_code == 404
    )

    after = database_client.get(
        "/api/v1/admin/recipes/stage-two-spritz/versions",
        headers=headers,
    )
    assert after.json()["items"][0]["action"] == "ROLLBACK"
    assert after.json()["items"][-1]["snapshot"] == original_snapshot


def test_recipe_rollback_rejects_missing_version(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)
    headers = editor_headers(database_client, database_session)

    response = database_client.post(
        "/api/v1/admin/recipes/classic-margarita/rollback",
        headers=headers,
        json={"expectedRevision": 1, "versionNo": 999},
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "CONTENT_VERSION_NOT_FOUND"
