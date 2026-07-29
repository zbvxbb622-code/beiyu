from datetime import timedelta

import pytest
from sqlmodel import Session
from starlette.testclient import TestClient

from app.db.models.accounts import utc_now
from app.modules.content.seed import seed_content
from tests.api.test_admin_content_lifecycle import editor_headers

RESOURCE_CASES = [
    (
        "ingredients",
        {
            "id": "elderflower-soda",
            "name": "接骨木气泡水",
            "category": "mixer",
            "description": "清爽花香",
        },
        {"name": "接骨木花气泡水"},
    ),
    (
        "bars",
        {
            "id": "stage-two-bar",
            "name": "杯语二号吧台",
            "imageKey": "barInterior",
            "rating": 4.5,
            "reviewCount": 0,
            "averageSpend": 88,
            "distanceLabel": "步行300m",
            "metroHint": "距离地铁站步行300m",
            "address": "测试路2号",
            "openHours": "18:00-02:00",
            "description": "用于验证内容管理",
            "tags": ["安静"],
            "tasteScore": 4.5,
            "environmentScore": 4.4,
            "serviceScore": 4.3,
            "phone": "021-55555555",
            "menu": [],
            "reviews": [],
        },
        {"name": "杯语二号酒吧"},
    ),
    (
        "knowledge",
        {
            "id": "k-stage-two",
            "recipeId": "gin-tonic",
            "name": "二阶段之杯",
            "englishName": "Stage Two",
            "imageKey": "ginTonic",
            "era": "2026 · 上海",
            "meaning": "把想法变成可以碰杯的现实。",
            "story": "这是一篇用于验证知识发布流程的内容。",
            "symbols": ["迭代", "陪伴"],
        },
        {"meaning": "稳定迭代，也认真陪伴。"},
    ),
    (
        "banners",
        {
            "id": "stage-two-banner",
            "brand": "Beiyu",
            "title": "（内容已经",
            "subtitle": "连上后端）",
            "scriptLabel": "Stage 2",
            "ctaLabel": "去看看",
            "targetRoute": "/recipes",
            "imageKey": "homeBanner",
            "sortOrder": 99,
        },
        {"ctaLabel": "查看酒谱"},
    ),
    (
        "shortcuts",
        {
            "id": "bars-entry",
            "title": "城市酒吧",
            "description": "看看附近的吧台",
            "icon": "cards",
            "route": "/bars",
            "sortOrder": 99,
        },
        {"description": "发现城市里的好吧台"},
    ),
]


def public_contains(client: TestClient, resource: str, public_id: str) -> bool:
    if resource == "ingredients":
        payload = client.get("/api/v1/ingredients?pageSize=100").json()
        return public_id in {item["id"] for item in payload["items"]}
    if resource == "bars":
        return client.get(f"/api/v1/bars/{public_id}").status_code == 200
    if resource == "knowledge":
        return client.get(f"/api/v1/knowledge/{public_id}").status_code == 200
    home = client.get("/api/v1/home").json()
    key = "banners" if resource == "banners" else "shortcuts"
    return public_id in {item["id"] for item in home[key]}


@pytest.mark.parametrize(("resource", "payload", "patch"), RESOURCE_CASES)
def test_admin_resource_lifecycle(
    database_client: TestClient,
    database_session: Session,
    resource: str,
    payload: dict[str, object],
    patch: dict[str, object],
) -> None:
    seed_content(database_session)
    headers = editor_headers(database_client, database_session)
    public_id = str(payload["id"])

    created = database_client.post(
        f"/api/v1/admin/{resource}",
        headers=headers,
        json=payload,
    )
    assert created.status_code == 201, created.text
    assert created.json()["status"] == "DRAFT"
    assert created.json()["revision"] == 1
    assert public_contains(database_client, resource, public_id) is False

    updated = database_client.patch(
        f"/api/v1/admin/{resource}/{public_id}",
        headers=headers,
        json={"expectedRevision": 1, **patch},
    )
    assert updated.status_code == 200, updated.text
    assert updated.json()["revision"] == 2

    published = database_client.post(
        f"/api/v1/admin/{resource}/{public_id}/publish",
        headers=headers,
        json={"expectedRevision": 2},
    )
    assert published.status_code == 200, published.text
    assert public_contains(database_client, resource, public_id) is True

    archived = database_client.post(
        f"/api/v1/admin/{resource}/{public_id}/archive",
        headers=headers,
        json={"expectedRevision": 3},
    )
    assert archived.status_code == 200, archived.text
    assert public_contains(database_client, resource, public_id) is False


def test_admin_non_recipe_versions_and_rollback(
    database_client: TestClient,
    database_session: Session,
) -> None:
    seed_content(database_session)
    headers = editor_headers(database_client, database_session)
    payload = RESOURCE_CASES[0][1]

    created = database_client.post(
        "/api/v1/admin/ingredients",
        headers=headers,
        json=payload,
    )
    assert created.status_code == 201
    updated = database_client.patch(
        "/api/v1/admin/ingredients/elderflower-soda",
        headers=headers,
        json={"expectedRevision": 1, "name": "修改后的名称"},
    )
    assert updated.status_code == 200

    versions = database_client.get(
        "/api/v1/admin/ingredients/elderflower-soda/versions",
        headers=headers,
    )
    assert versions.status_code == 200
    assert [
        (item["versionNo"], item["action"]) for item in versions.json()["items"]
    ] == [(2, "UPDATE"), (1, "CREATE")]

    rollback = database_client.post(
        "/api/v1/admin/ingredients/elderflower-soda/rollback",
        headers=headers,
        json={"expectedRevision": 2, "versionNo": 1},
    )
    assert rollback.status_code == 200, rollback.text
    assert rollback.json()["name"] == "接骨木气泡水"
    assert rollback.json()["status"] == "DRAFT"
    assert rollback.json()["revision"] == 3


def test_admin_rejects_invalid_banner_schedule(
    database_client: TestClient,
    database_session: Session,
) -> None:
    headers = editor_headers(database_client, database_session)
    payload = {
        **RESOURCE_CASES[3][1],
        "id": "invalid-schedule",
        "startsAt": "2026-08-02T00:00:00Z",
        "endsAt": "2026-08-01T00:00:00Z",
    }

    response = database_client.post(
        "/api/v1/admin/banners",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 422


def test_admin_can_publish_a_banner_with_a_valid_schedule(
    database_client: TestClient,
    database_session: Session,
) -> None:
    headers = editor_headers(database_client, database_session)
    now = utc_now()
    payload = {
        **RESOURCE_CASES[3][1],
        "id": "valid-schedule",
        "startsAt": (now - timedelta(days=1)).isoformat(),
        "endsAt": (now + timedelta(days=1)).isoformat(),
    }

    created = database_client.post(
        "/api/v1/admin/banners",
        headers=headers,
        json=payload,
    )
    assert created.status_code == 201, created.text

    published = database_client.post(
        "/api/v1/admin/banners/valid-schedule/publish",
        headers=headers,
        json={"expectedRevision": 1},
    )

    assert published.status_code == 200, published.text
    assert public_contains(
        database_client,
        "banners",
        "valid-schedule",
    )


def test_admin_rejects_non_http_image_url(
    database_client: TestClient,
    database_session: Session,
) -> None:
    headers = editor_headers(database_client, database_session)
    payload = {
        **RESOURCE_CASES[0][1],
        "id": "unsafe-image-url",
        "imageUrl": "file:///private/image.jpg",
    }

    response = database_client.post(
        "/api/v1/admin/ingredients",
        headers=headers,
        json=payload,
    )

    assert response.status_code == 422
