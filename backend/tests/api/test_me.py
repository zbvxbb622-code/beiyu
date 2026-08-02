from datetime import UTC, date, datetime
from uuid import UUID

import pytest
from sqlmodel import Session, select
from starlette.testclient import TestClient

from app.api.routes import me
from app.core.config import Settings, get_settings
from app.db.models import (
    AiChatMode,
    AiConversation,
    AiDailyQuota,
    AiMemory,
    AiMemoryCategory,
    AiMemorySource,
    AiMessage,
    AiMessageRole,
    AiRequest,
    AiUsageLog,
    CommunityComment,
    CommunityCommentLike,
    CommunityPost,
    CommunityPostLike,
    User,
    UserProfile,
    UserStatus,
)
from app.modules.users import service as users_service
from tests.api.test_auth_sessions import bearer, create_login


def test_profile_defaults_and_partial_update(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    initial = database_client.get("/api/v1/me/profile", headers=headers)
    assert initial.status_code == 200
    assert initial.json() == {
        "nickname": "测试账号",
        "avatarKey": "avatarOne",
        "avatarUri": None,
        "signature": "",
        "city": "",
        "gender": None,
        "birthday": None,
        "showBirthdayTag": True,
        "showAge": True,
        "showZodiac": False,
        "occupation": None,
        "school": None,
    }

    updated = database_client.patch(
        "/api/v1/me/profile",
        headers=headers,
        json={
            "nickname": "杯语用户",
            "signature": "今晚也想认真喝一杯",
            "birthday": "2000-08-12",
            "showZodiac": True,
        },
    )

    assert updated.status_code == 200, updated.text
    assert updated.json()["nickname"] == "杯语用户"
    assert updated.json()["city"] == ""
    assert updated.json()["birthday"] == "2000-08-12"
    assert updated.json()["showZodiac"] is True


def test_profile_rejects_frontend_overflow(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.patch(
        "/api/v1/me/profile",
        headers=bearer(login["accessToken"]),
        json={"nickname": "超" * 17},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_profile_rejects_null_for_required_display_fields(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.patch(
        "/api/v1/me/profile",
        headers=bearer(login["accessToken"]),
        json={"nickname": None},
    )

    assert response.status_code == 422
    assert response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_privacy_and_age_confirmation_are_persisted(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])

    privacy = database_client.patch(
        "/api/v1/me/privacy",
        headers=headers,
        json={"localOnlyMode": False, "syncWhenLoggedIn": True},
    )
    age = database_client.post(
        "/api/v1/me/age-confirmation",
        headers=headers,
        json={"confirmed": True},
    )

    assert privacy.status_code == 200
    assert privacy.json() == {
        "localOnlyMode": False,
        "analyticsOptIn": False,
        "syncWhenLoggedIn": True,
    }
    assert age.status_code == 200
    assert age.json()["ageConfirmed"] is True
    assert database_session.exec(select(User)).one().age_confirmed_at is not None


def test_bootstrap_exposes_mobile_contract_without_internal_secrets(
    database_client: TestClient,
) -> None:
    login = create_login(database_client)

    response = database_client.get(
        "/api/v1/me/bootstrap",
        headers=bearer(login["accessToken"]),
    )

    assert response.status_code == 200
    body = response.json()
    assert body["user"]["phoneMasked"] == "+86138****8000"
    assert body["profile"]["nickname"] == "测试账号"
    assert body["privacy"]["localOnlyMode"] is True
    assert body["accountSecurity"]["phoneVerified"] is True
    assert body["accountSecurity"]["realnameVerified"] is False
    assert body["featureFlags"]["realSms"] is False
    assert body["featureFlags"]["legalNameVerification"] is False
    serialized = response.text
    assert "phoneHash" not in serialized
    assert "refreshToken" not in serialized
    assert "secret" not in serialized.lower()


def test_bootstrap_exposes_configured_ai_allowance(
    database_client: TestClient,
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        ai_enabled=True,
        ai_daily_limit=50,
    )
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    database_client.app.dependency_overrides[get_settings] = lambda: settings
    monkeypatch.setattr(me, "utc_now", lambda: now)
    login = create_login(database_client)
    user = database_session.exec(select(User)).one()
    user.age_confirmed_at = now
    database_session.add(user)
    database_session.add(
        AiDailyQuota(
            user_id=user.id,
            quota_date=date(2026, 7, 29),
            free_limit=50,
            used_count=17,
            reserved_count=2,
        )
    )
    database_session.flush()
    original_quota_snapshot = users_service.quota_snapshot
    queried_user_ids: list[object] = []

    def record_quota_snapshot(
        session: Session,
        user_id: UUID,
        quota_settings: Settings,
        quota_now: datetime,
    ):
        queried_user_ids.append(user_id)
        return original_quota_snapshot(session, user_id, quota_settings, quota_now)

    monkeypatch.setattr(users_service, "quota_snapshot", record_quota_snapshot)

    response = database_client.get(
        "/api/v1/me/bootstrap",
        headers=bearer(login["accessToken"]),
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["ai"] == {
        "dailyMessageLimit": 50,
        "messagesUsedToday": 19,
        "remaining": 31,
        "resetsAt": "2026-07-29T16:00:00Z",
    }
    assert body["featureFlags"]["aiChat"] is True
    assert queried_user_ids == [user.id]


@pytest.mark.parametrize(
    ("status", "age_confirmed", "ai_enabled", "expected_flag"),
    [
        (UserStatus.BANNED, False, True, False),
        (UserStatus.ACTIVE, False, True, False),
        (UserStatus.ACTIVE, True, False, False),
    ],
)
def test_bootstrap_skips_quota_snapshot_when_ai_access_is_unavailable(
    database_client: TestClient,
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    status: UserStatus,
    age_confirmed: bool,
    ai_enabled: bool,
    expected_flag: bool,
) -> None:
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    settings = Settings(
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        ai_enabled=ai_enabled,
    )
    database_client.app.dependency_overrides[get_settings] = lambda: settings
    monkeypatch.setattr(me, "utc_now", lambda: now)
    login = create_login(database_client)
    user = database_session.exec(select(User)).one()
    user.status = status
    user.age_confirmed_at = now if age_confirmed else None
    database_session.add(user)
    database_session.commit()

    def quota_snapshot_must_not_run(*_: object, **__: object) -> object:
        raise AssertionError("bootstrap must not select an AI quota without access")

    monkeypatch.setattr(users_service, "quota_snapshot", quota_snapshot_must_not_run)

    response = database_client.get(
        "/api/v1/me/bootstrap",
        headers=bearer(login["accessToken"]),
    )

    assert response.status_code == 200, response.text
    assert response.json()["ai"] == {
        "dailyMessageLimit": 0,
        "messagesUsedToday": 0,
        "remaining": 0,
        "resetsAt": "2026-07-29T16:00:00Z",
    }
    assert response.json()["featureFlags"]["aiChat"] is expected_flag


def test_bootstrap_keeps_ai_flag_enabled_when_quota_is_exhausted(
    database_client: TestClient,
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    database_client.app.dependency_overrides[get_settings] = lambda: Settings(
        database_url="postgresql+psycopg://user:pass@db/beiyu",
    )
    monkeypatch.setattr(me, "utc_now", lambda: now)
    login = create_login(database_client)
    user = database_session.exec(select(User)).one()
    user.age_confirmed_at = now
    database_session.add(user)
    database_session.add(
        AiDailyQuota(
            user_id=user.id,
            quota_date=date(2026, 7, 29),
            free_limit=50,
            used_count=48,
            reserved_count=2,
        )
    )
    database_session.commit()

    response = database_client.get(
        "/api/v1/me/bootstrap",
        headers=bearer(login["accessToken"]),
    )

    assert response.status_code == 200, response.text
    assert response.json()["ai"]["remaining"] == 0
    assert response.json()["featureFlags"]["aiChat"] is True


def test_bootstrap_propagates_quota_database_errors_for_allowed_user(
    database_client: TestClient,
    database_session: Session,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    database_client.app.dependency_overrides[get_settings] = lambda: Settings(
        database_url="postgresql+psycopg://user:pass@db/beiyu",
    )
    monkeypatch.setattr(me, "utc_now", lambda: now)
    login = create_login(database_client)
    user = database_session.exec(select(User)).one()
    user.age_confirmed_at = now
    database_session.add(user)
    database_session.commit()

    def fail_quota_snapshot(*_: object, **__: object) -> object:
        raise RuntimeError("quota database unavailable")

    monkeypatch.setattr(users_service, "quota_snapshot", fail_quota_snapshot)

    with pytest.raises(RuntimeError, match="quota database unavailable"):
        database_client.get(
            "/api/v1/me/bootstrap",
            headers=bearer(login["accessToken"]),
        )


def test_delete_account_anonymizes_profile_and_revokes_access(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    original_phone_hash = database_session.exec(select(User)).one().phone_hash

    response = database_client.request(
        "DELETE",
        "/api/v1/me/account",
        headers=headers,
        json={"confirmation": "DELETE"},
    )

    assert response.status_code == 204
    user = database_session.exec(select(User)).one()
    profile = database_session.exec(select(UserProfile)).one()
    assert user.status is UserStatus.DELETED
    assert user.deleted_at is not None
    assert user.anonymized_at is not None
    assert user.phone_hash != original_phone_hash
    assert user.phone_hash.startswith("deleted:")
    assert profile.nickname == "已注销用户"
    assert profile.birthday is None
    assert (
        database_client.get(
            "/api/v1/me/profile",
            headers=headers,
        ).status_code
        == 401
    )


def test_delete_account_removes_user_generated_ai_and_community_content(
    database_client: TestClient,
    database_session: Session,
) -> None:
    login = create_login(database_client)
    headers = bearer(login["accessToken"])
    user = database_session.exec(select(User)).one()

    conversation = AiConversation(user_id=user.id, title="注销清理对话")
    database_session.add(conversation)
    database_session.flush()
    message = AiMessage(
        conversation_id=conversation.id,
        user_id=user.id,
        role=AiMessageRole.USER,
        content="注销后不应保留",
    )
    database_session.add(message)
    database_session.flush()
    memory = AiMemory(
        user_id=user.id,
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="delete-account-marker",
        summary="注销后不应保留的记忆",
    )
    request = AiRequest(
        user_id=user.id,
        conversation_id=conversation.id,
        client_message_id=UUID("00000000-0000-4000-8000-000000000001"),
        mode=AiChatMode.NORMAL,
        quota_date=date(2026, 8, 2),
        response_message_id=message.id,
    )
    database_session.add(memory)
    database_session.add(request)
    database_session.flush()
    database_session.add(
        AiMemorySource(
            memory_id=memory.id,
            conversation_id=conversation.id,
            source_message_id=message.id,
        )
    )
    usage_log = AiUsageLog(
        request_id=request.id,
        attempt_no=1,
        user_id=user.id,
        conversation_id=conversation.id,
        mode=AiChatMode.NORMAL,
        outcome="SUCCEEDED",
        provider="test",
        model="test-model",
        prompt_version="test",
        latency_ms=10,
    )
    database_session.add(usage_log)

    post = CommunityPost(author_id=user.id, title="注销清理帖子", body="注销后不应保留")
    database_session.add(post)
    database_session.flush()
    comment = CommunityComment(post_id=post.id, author_id=user.id, text="注销后不应保留")
    database_session.add(comment)
    database_session.flush()
    database_session.add(CommunityPostLike(post_id=post.id, user_id=user.id))
    database_session.add(CommunityCommentLike(comment_id=comment.id, user_id=user.id))
    database_session.commit()

    response = database_client.request(
        "DELETE",
        "/api/v1/me/account",
        headers=headers,
        json={"confirmation": "DELETE"},
    )

    assert response.status_code == 204
    assert database_session.exec(select(AiConversation)).all() == []
    assert database_session.exec(select(AiMessage)).all() == []
    assert database_session.exec(select(AiMemory)).all() == []
    assert database_session.exec(select(AiMemorySource)).all() == []
    assert database_session.exec(select(CommunityPost)).all() == []
    assert database_session.exec(select(CommunityComment)).all() == []
    assert database_session.exec(select(CommunityPostLike)).all() == []
    assert database_session.exec(select(CommunityCommentLike)).all() == []
    assert database_session.exec(select(AiUsageLog)).one().conversation_id is None
