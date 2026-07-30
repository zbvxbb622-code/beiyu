from datetime import UTC, datetime
from uuid import uuid4

from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.db.models import AiMemory, AiMemoryCategory, AiMemoryTombstone, User
from tests.api.test_auth_sessions import bearer, create_login


def _login_with_ai_access(
    client: TestClient,
    session: Session,
) -> tuple[dict[str, object], User]:
    login = create_login(client)
    user = session.exec(select(User)).one()
    user.age_confirmed_at = datetime(2026, 7, 29, 12, tzinfo=UTC)
    session.add(user)
    session.commit()
    return login, user


def test_ai_memory_list_delete_clear_and_settings_routes(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login, user = _login_with_ai_access(database_client, database_session)
    headers = bearer(login["accessToken"])
    first = AiMemory(
        user_id=user.id,
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="taste:crisp-low-sugar",
        summary="偏好清爽、低甜的饮品",
    )
    second = AiMemory(
        user_id=user.id,
        category=AiMemoryCategory.EMOTIONAL_PREFERENCE,
        memory_key="reply:gentle",
        summary="希望先被温柔倾听",
    )
    database_session.add_all([first, second])
    database_session.commit()

    listed = database_client.get("/api/v1/ai/memories", headers=headers)
    assert listed.status_code == 200
    assert {item["summary"] for item in listed.json()["items"]} == {
        "偏好清爽、低甜的饮品",
        "希望先被温柔倾听",
    }

    disabled = database_client.patch(
        "/api/v1/ai/memory-settings",
        headers=headers,
        json={"enabled": False},
    )
    assert disabled.status_code == 200
    assert disabled.json() == {"enabled": False}
    assert database_session.exec(select(User).where(User.id == user.id)).one().memory_enabled is False

    delete_one = database_client.delete(
        f"/api/v1/ai/memories/{first.id}",
        headers=headers,
    )
    assert delete_one.status_code == 204
    assert database_session.get(AiMemory, first.id) is None
    assert len(database_session.exec(select(AiMemoryTombstone)).all()) == 1

    clear = database_client.delete("/api/v1/ai/memories", headers=headers)
    assert clear.status_code == 204
    assert database_session.exec(select(AiMemory)).all() == []
    assert len(database_session.exec(select(AiMemoryTombstone)).all()) == 2

    enabled = database_client.patch(
        "/api/v1/ai/memory-settings",
        headers=headers,
        json={"enabled": True},
    )
    assert enabled.status_code == 200
    assert enabled.json() == {"enabled": True}


def test_ai_memory_delete_is_user_scoped(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login, user = _login_with_ai_access(database_client, database_session)
    headers = bearer(login["accessToken"])
    foreign = User(
        phone_hash=f"foreign-{uuid4().hex}",
        phone_masked="+86139****0000",
        age_confirmed_at=datetime(2026, 7, 29, 12, tzinfo=UTC),
    )
    database_session.add(foreign)
    database_session.flush()
    foreign_memory = AiMemory(
        user_id=foreign.id,
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="taste:foreign",
        summary="别人偏好清爽",
    )
    database_session.add(foreign_memory)
    database_session.commit()

    response = database_client.delete(
        f"/api/v1/ai/memories/{foreign_memory.id}",
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json()["error"]["code"] == "AI_MEMORY_NOT_FOUND"
    assert database_session.get(AiMemory, foreign_memory.id) is not None
    assert database_session.exec(select(User).where(User.id == user.id)).one() is not None
