from collections import Counter
from collections.abc import Callable
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import event
from sqlalchemy.orm.exc import ObjectDeletedError
from sqlmodel import Session, select

from app.core.errors import AppError
from app.db.models import (
    AiChatMode,
    AiConversation,
    AiMemory,
    AiMemoryCategory,
    AiMemorySource,
    AiMessage,
    AiMessageRole,
    AiRequest,
    AiRequestStatus,
    AiSafetyLabel,
    AiUsageLog,
    User,
    UserProfile,
)
from app.db.session import get_engine
from app.modules.ai import conversations
from app.modules.ai.memory import remove_conversation_memory_sources_bulk


def persisted_user(session: Session, suffix: str = "owner") -> User:
    user = User(
        phone_hash=f"conversation-{suffix}-{uuid4().hex}",
        phone_masked="+86138****0000",
    )
    session.add(user)
    session.flush()
    return user


def assert_not_found(callback: Callable[[], object]) -> None:
    with pytest.raises(AppError) as exc_info:
        callback()
    assert exc_info.value.code == "AI_CONVERSATION_NOT_FOUND"
    assert exc_info.value.status_code == 404


def normal_request(
    session: Session,
    *,
    user: User,
    conversation: AiConversation,
    status: AiRequestStatus = AiRequestStatus.RESERVED,
) -> AiRequest:
    request = AiRequest(
        user_id=user.id,
        conversation_id=conversation.id,
        client_message_id=uuid4(),
        mode=AiChatMode.NORMAL,
        status=status,
        quota_date=datetime(2026, 7, 29, tzinfo=UTC).date(),
        reservation_expires_at=datetime(2026, 8, 1, tzinfo=UTC),
    )
    session.add(request)
    session.flush()
    return request


def test_owned_conversation_reads_hide_empty_rows_and_page_stably(
    database_session: Session,
) -> None:
    owner = persisted_user(database_session)
    other = persisted_user(database_session, "other")
    timestamp = datetime(2026, 7, 29, 12, tzinfo=UTC)
    empty = AiConversation(user_id=owner.id, created_at=timestamp, updated_at=timestamp)
    first = AiConversation(
        user_id=owner.id,
        title="first",
        last_message_at=timestamp,
        created_at=timestamp,
        updated_at=timestamp,
    )
    second = AiConversation(
        user_id=owner.id,
        title="second",
        last_message_at=timestamp,
        created_at=timestamp,
        updated_at=timestamp,
    )
    foreign = AiConversation(
        user_id=other.id,
        title="foreign",
        last_message_at=timestamp,
        created_at=timestamp,
        updated_at=timestamp,
    )
    database_session.add_all([empty, first, second, foreign])
    database_session.flush()

    page_one = conversations.list_conversations(
        session=database_session, user=owner, page=1, page_size=1, now=timestamp
    )
    page_two = conversations.list_conversations(
        session=database_session, user=owner, page=2, page_size=1, now=timestamp
    )

    expected = sorted([first.id, second.id], reverse=True)
    assert [item.id for item in page_one.items + page_two.items] == expected
    assert page_one.pagination.model_dump() == {
        "page": 1,
        "pageSize": 1,
        "totalItems": 2,
        "totalPages": 2,
    }
    assert page_two.pagination.model_dump() == {
        "page": 2,
        "pageSize": 1,
        "totalItems": 2,
        "totalPages": 2,
    }
    assert empty.id not in {item.id for item in page_one.items + page_two.items}
    assert foreign.id not in {item.id for item in page_one.items + page_two.items}

    forged_owner = User(id=other.id, phone_hash="forged", phone_masked="+86138****9999")
    assert_not_found(
        lambda: conversations.get_owned_conversation(
            session=database_session, user=forged_owner, conversation_id=first.id
        )
    )


def test_messages_are_owned_oldest_first_and_paginated_without_overlap(
    database_session: Session,
) -> None:
    owner = persisted_user(database_session)
    other = persisted_user(database_session, "other")
    conversation = AiConversation(user_id=owner.id)
    foreign_conversation = AiConversation(user_id=other.id)
    database_session.add_all([conversation, foreign_conversation])
    database_session.flush()
    timestamp = datetime(2026, 7, 29, 12, tzinfo=UTC)
    messages = [
        AiMessage(
            conversation_id=conversation.id,
            user_id=owner.id,
            role=AiMessageRole.USER,
            content=f"message-{index}",
            created_at=timestamp,
        )
        for index in range(3)
    ]
    database_session.add_all(messages)
    database_session.flush()

    page_one = conversations.list_messages(
        session=database_session,
        user=owner,
        conversation_id=conversation.id,
        page=1,
        page_size=2,
    )
    page_two = conversations.list_messages(
        session=database_session,
        user=owner,
        conversation_id=conversation.id,
        page=2,
        page_size=2,
    )

    expected = sorted(messages, key=lambda item: item.id)
    assert [item.id for item in page_one.items + page_two.items] == [
        item.id for item in expected
    ]
    assert page_two.pagination.model_dump() == {
        "page": 2,
        "pageSize": 2,
        "totalItems": 3,
        "totalPages": 2,
    }
    assert_not_found(
        lambda: conversations.list_messages(
            session=database_session,
            user=other,
            conversation_id=conversation.id,
            page=1,
            page_size=50,
        )
    )


def test_conversation_and_message_page_size_limits_are_distinct(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation = AiConversation(
        user_id=user.id,
        last_message_at=datetime(2026, 7, 29, 12, tzinfo=UTC),
    )
    database_session.add(conversation)
    database_session.flush()

    with pytest.raises(ValueError, match="conversation page_size"):
        conversations.list_conversations(
            session=database_session,
            user=user,
            page=1,
            page_size=51,
            now=datetime(2026, 7, 29, 12, tzinfo=UTC),
        )

    assert conversations.list_messages(
        session=database_session,
        user=user,
        conversation_id=conversation.id,
        page=1,
        page_size=51,
    ).pagination.page_size == 51
    assert conversations.list_messages(
        session=database_session,
        user=user,
        conversation_id=conversation.id,
        page=1,
        page_size=100,
    ).pagination.page_size == 100
    with pytest.raises(ValueError, match="message page_size"):
        conversations.list_messages(
            session=database_session,
            user=user,
            conversation_id=conversation.id,
            page=1,
            page_size=101,
        )


def test_create_and_list_clean_only_owned_stale_empty_conversations(
    database_session: Session,
) -> None:
    owner = persisted_user(database_session)
    other = persisted_user(database_session, "other")
    now = datetime(2026, 7, 30, 12, tzinfo=UTC)
    stale = AiConversation(
        user_id=owner.id,
        created_at=now - timedelta(hours=24, microseconds=1),
        updated_at=now - timedelta(hours=24, microseconds=1),
    )
    boundary = AiConversation(
        user_id=owner.id,
        created_at=now - timedelta(hours=24),
        updated_at=now - timedelta(hours=24),
    )
    foreign_stale = AiConversation(
        user_id=other.id,
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(days=2),
    )
    live = AiConversation(
        user_id=owner.id,
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(days=2),
    )
    expired = AiConversation(
        user_id=owner.id,
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(days=2),
    )
    failed = AiConversation(
        user_id=owner.id,
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(days=2),
    )
    database_session.add_all([stale, boundary, foreign_stale, live, expired, failed])
    database_session.flush()
    stale_id = stale.id
    boundary_id = boundary.id
    foreign_stale_id = foreign_stale.id
    live_id = live.id
    expired_id = expired.id
    failed_id = failed.id
    normal_request(database_session, user=owner, conversation=live)
    expired_request = normal_request(database_session, user=owner, conversation=expired)
    expired_request.reservation_expires_at = now - timedelta(microseconds=1)
    normal_request(
        database_session,
        user=owner,
        conversation=failed,
        status=AiRequestStatus.FAILED,
    )
    database_session.flush()

    created = conversations.create_conversation(
        session=database_session, user=owner, now=now
    )

    assert database_session.get(AiConversation, stale_id) is None
    assert database_session.get(AiConversation, boundary_id) is not None
    assert database_session.get(AiConversation, foreign_stale_id) is not None
    assert database_session.get(AiConversation, live_id) is not None
    assert database_session.get(AiConversation, expired_id) is None
    assert database_session.get(AiConversation, failed_id) is None
    assert created.last_message_at is None


def test_save_exchange_persists_a_stable_pair_and_replays_without_duplicates(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation = AiConversation(user_id=user.id)
    database_session.add(conversation)
    database_session.flush()
    request = normal_request(database_session, user=user, conversation=conversation)
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)

    recipe_id = uuid4()
    saved = conversations.save_exchange(
        session=database_session,
        user=user,
        conversation_id=conversation.id,
        request_id=request.id,
        user_content="我的手机号是13800138000，想喝清爽一点",
        assistant_content="可以试试柑橘和气泡感更强的组合。",
        reviewed_recipe_ids=[recipe_id],
        user_safety_label=AiSafetyLabel.PRIVACY_SENSITIVE,
        assistant_safety_label=AiSafetyLabel.OUTPUT_REPLACED,
        now=now,
    )

    assert saved.conversation.title == "新的对话"
    assert saved.conversation.last_message_at == saved.assistant_message.created_at
    assert saved.user_message.role is AiMessageRole.USER
    assert saved.user_message.safety_label is AiSafetyLabel.PRIVACY_SENSITIVE
    assert saved.assistant_message.role is AiMessageRole.ASSISTANT
    assert saved.assistant_message.recipe_ids == [recipe_id]
    assert saved.assistant_message.safety_label is AiSafetyLabel.OUTPUT_REPLACED
    assert saved.user_message.created_at < saved.assistant_message.created_at

    request.status = AiRequestStatus.SUCCEEDED
    request.response_message_id = saved.assistant_message.id
    database_session.flush()
    replay = conversations.save_exchange(
        session=database_session,
        user=user,
        conversation_id=conversation.id,
        request_id=request.id,
        user_content="不会被第二次保存",
        assistant_content="不会被第二次保存",
        reviewed_recipe_ids=[],
        user_safety_label=AiSafetyLabel.SAFE,
        assistant_safety_label=AiSafetyLabel.SAFE,
        now=now + timedelta(minutes=1),
    )

    assert replay == saved
    assert len(
        database_session.exec(
            select(AiMessage).where(AiMessage.conversation_id == conversation.id)
        ).all()
    ) == 2


def test_save_exchange_rejects_a_foreign_response_association_without_writes(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    other = persisted_user(database_session, "other")
    conversation = AiConversation(user_id=user.id)
    foreign_conversation = AiConversation(user_id=other.id)
    database_session.add_all([conversation, foreign_conversation])
    database_session.flush()
    request = normal_request(database_session, user=user, conversation=conversation)
    foreign_response = AiMessage(
        conversation_id=foreign_conversation.id,
        user_id=other.id,
        role=AiMessageRole.ASSISTANT,
        content="不属于此请求",
    )
    database_session.add(foreign_response)
    database_session.flush()
    request.response_message_id = foreign_response.id
    database_session.flush()

    with pytest.raises(AppError) as exc_info:
        conversations.save_exchange(
            session=database_session,
            user=user,
            conversation_id=conversation.id,
            request_id=request.id,
            user_content="不要写入",
            assistant_content="不要写入",
            reviewed_recipe_ids=[],
            user_safety_label=AiSafetyLabel.SAFE,
            assistant_safety_label=AiSafetyLabel.SAFE,
            now=datetime(2026, 7, 29, 12, tzinfo=UTC),
        )

    assert exc_info.value.code == "AI_REQUEST_RESPONSE_INVALID"
    assert database_session.exec(
        select(AiMessage).where(AiMessage.conversation_id == conversation.id)
    ).all() == []


def test_delete_conversation_cleans_orphans_and_preserves_audit_rows(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation = AiConversation(user_id=user.id)
    shared_conversation = AiConversation(user_id=user.id)
    database_session.add_all([conversation, shared_conversation])
    database_session.flush()
    source = AiMessage(
        conversation_id=conversation.id,
        user_id=user.id,
        role=AiMessageRole.USER,
        content="我喜欢低甜",
    )
    shared_source = AiMessage(
        conversation_id=shared_conversation.id,
        user_id=user.id,
        role=AiMessageRole.USER,
        content="我喜欢低甜",
    )
    response = AiMessage(
        conversation_id=conversation.id,
        user_id=user.id,
        role=AiMessageRole.ASSISTANT,
        content="收到",
    )
    database_session.add_all([source, shared_source, response])
    database_session.flush()
    orphan = AiMemory(
        user_id=user.id,
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="orphan",
        summary="偏好低甜",
    )
    shared = AiMemory(
        user_id=user.id,
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="shared",
        summary="偏好清爽",
    )
    database_session.add_all([orphan, shared])
    database_session.flush()
    database_session.add_all(
        [
            AiMemorySource(
                memory_id=orphan.id,
                conversation_id=conversation.id,
                source_message_id=source.id,
            ),
            AiMemorySource(
                memory_id=shared.id,
                conversation_id=conversation.id,
                source_message_id=source.id,
            ),
            AiMemorySource(
                memory_id=shared.id,
                conversation_id=shared_conversation.id,
                source_message_id=shared_source.id,
            ),
        ]
    )
    request = normal_request(database_session, user=user, conversation=conversation)
    request.response_message_id = response.id
    usage = AiUsageLog(
        request_id=request.id,
        attempt_no=1,
        user_id=user.id,
        conversation_id=conversation.id,
        mode=AiChatMode.NORMAL,
        outcome="SUCCEEDED",
        provider="test",
        model="test",
        prompt_version="v1",
        latency_ms=1,
    )
    database_session.add(usage)
    profile = UserProfile(user_id=user.id, nickname="删除前")
    database_session.add(profile)
    database_session.flush()
    orphan_source_id = database_session.exec(
        select(AiMemorySource.id).where(AiMemorySource.memory_id == orphan.id)
    ).one()
    source_id = source.id
    response_id = response.id
    orphan_id = orphan.id
    shared_id = shared.id
    request_id = request.id
    usage_id = usage.id
    conversation_id = conversation.id
    database_session.expire_all()
    loaded_request = database_session.get(AiRequest, request_id)
    loaded_usage = database_session.get(AiUsageLog, usage_id)
    loaded_source = database_session.get(AiMemorySource, orphan_source_id)
    loaded_orphan = database_session.get(AiMemory, orphan_id)
    loaded_shared = database_session.get(AiMemory, shared_id)
    loaded_user_message = database_session.get(AiMessage, source_id)
    loaded_assistant_message = database_session.get(AiMessage, response_id)
    loaded_profile = database_session.get(UserProfile, user.id)
    assert all(
        value is not None
        for value in [
            loaded_request,
            loaded_usage,
            loaded_source,
            loaded_orphan,
            loaded_shared,
            loaded_user_message,
            loaded_assistant_message,
            loaded_profile,
        ]
    )
    assert loaded_profile is not None
    loaded_profile.nickname = "删除后仍待保存"

    conversations.delete_conversation(
        session=database_session, user=user, conversation_id=conversation_id
    )
    assert database_session.is_modified(loaded_profile)

    assert database_session.get(AiConversation, conversation_id) is None
    assert database_session.get(AiMessage, source_id) is None
    assert database_session.get(AiMessage, response_id) is None
    assert database_session.get(AiMemory, orphan_id) is None
    assert database_session.get(AiMemory, shared_id) is not None
    assert database_session.get(AiMemorySource, orphan_source_id) is None
    persisted_request = database_session.get(AiRequest, request_id)
    persisted_usage = database_session.get(AiUsageLog, usage_id)
    assert persisted_request is not None
    assert persisted_usage is not None
    assert persisted_request.conversation_id is None
    assert persisted_request.response_message_id is None
    assert persisted_usage.conversation_id is None
    assert loaded_request is not None
    assert loaded_usage is not None
    assert loaded_source is not None
    assert loaded_orphan is not None
    assert loaded_shared is not None
    assert loaded_user_message is not None
    assert loaded_assistant_message is not None
    assert loaded_request.conversation_id is None
    assert loaded_request.response_message_id is None
    assert loaded_usage.conversation_id is None
    assert loaded_shared.summary == "偏好清爽"
    assert loaded_profile.nickname == "删除后仍待保存"
    with pytest.raises(ObjectDeletedError):
        _ = loaded_source.conversation_id
    with pytest.raises(ObjectDeletedError):
        _ = loaded_orphan.summary
    with pytest.raises(ObjectDeletedError):
        _ = loaded_user_message.content
    with pytest.raises(ObjectDeletedError):
        _ = loaded_assistant_message.content


def test_stale_cleanup_refreshes_loaded_request_usage_without_expiring_profile(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    now = datetime(2026, 7, 30, 12, tzinfo=UTC)
    conversation = AiConversation(
        user_id=user.id,
        created_at=now - timedelta(days=2),
        updated_at=now - timedelta(days=2),
    )
    database_session.add(conversation)
    database_session.flush()
    request = normal_request(
        database_session,
        user=user,
        conversation=conversation,
        status=AiRequestStatus.FAILED,
    )
    usage = AiUsageLog(
        request_id=request.id,
        attempt_no=1,
        user_id=user.id,
        conversation_id=conversation.id,
        mode=AiChatMode.NORMAL,
        outcome="FAILED",
        provider="test",
        model="test",
        prompt_version="v1",
        latency_ms=1,
    )
    profile = UserProfile(user_id=user.id, nickname="清理前")
    database_session.add_all([usage, profile])
    database_session.flush()
    request_id = request.id
    usage_id = usage.id
    conversation_id = conversation.id
    database_session.expire_all()
    loaded_request = database_session.get(AiRequest, request_id)
    loaded_usage = database_session.get(AiUsageLog, usage_id)
    loaded_profile = database_session.get(UserProfile, user.id)
    assert loaded_request is not None
    assert loaded_usage is not None
    assert loaded_profile is not None
    loaded_profile.nickname = "清理后仍待保存"

    assert conversations.cleanup_stale_empty_conversations(
        session=database_session, user=user, now=now
    ) == 1
    assert database_session.is_modified(loaded_profile)

    assert database_session.get(AiConversation, conversation_id) is None
    assert loaded_request.conversation_id is None
    assert loaded_request.response_message_id is None
    assert loaded_usage.conversation_id is None
    assert loaded_profile.nickname == "清理后仍待保存"


def test_same_session_can_delete_two_preloaded_conversations_after_database_effects(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversations_to_delete = [AiConversation(user_id=user.id) for _ in range(2)]
    database_session.add_all(conversations_to_delete)
    database_session.flush()
    messages = [
        AiMessage(
            conversation_id=conversation.id,
            user_id=user.id,
            role=role,
            content=f"{index}-{role.value}",
        )
        for index, conversation in enumerate(conversations_to_delete)
        for role in (AiMessageRole.USER, AiMessageRole.ASSISTANT)
    ]
    database_session.add_all(messages)
    database_session.flush()
    requests = []
    usages = []
    for index, conversation in enumerate(conversations_to_delete):
        request = normal_request(database_session, user=user, conversation=conversation)
        request.response_message_id = messages[index * 2 + 1].id
        requests.append(request)
        usages.append(
            AiUsageLog(
                request_id=request.id,
                attempt_no=1,
                user_id=user.id,
                conversation_id=conversation.id,
                mode=AiChatMode.NORMAL,
                outcome="SUCCEEDED",
                provider="test",
                model="test",
                prompt_version="v1",
                latency_ms=1,
            )
        )
    database_session.add_all(usages)
    database_session.flush()
    conversation_ids = [conversation.id for conversation in conversations_to_delete]
    message_ids = [message.id for message in messages]
    request_ids = [request.id for request in requests]
    usage_ids = [usage.id for usage in usages]
    database_session.expire_all()
    loaded_requests = [database_session.get(AiRequest, request_id) for request_id in request_ids]
    loaded_usages = [database_session.get(AiUsageLog, usage_id) for usage_id in usage_ids]
    loaded_messages = [database_session.get(AiMessage, message_id) for message_id in message_ids]
    assert all(loaded_requests)
    assert all(loaded_usages)
    assert all(loaded_messages)

    for conversation_id in conversation_ids:
        conversations.delete_conversation(
            session=database_session, user=user, conversation_id=conversation_id
        )

    assert [database_session.get(AiConversation, conversation_id) for conversation_id in conversation_ids] == [
        None,
        None,
    ]
    assert [database_session.get(AiMessage, message_id) for message_id in message_ids] == [
        None,
        None,
        None,
        None,
    ]
    assert all(request is not None and request.conversation_id is None for request in loaded_requests)
    assert all(request is not None and request.response_message_id is None for request in loaded_requests)
    assert all(usage is not None and usage.conversation_id is None for usage in loaded_usages)


def test_delete_and_cleanup_keep_unrelated_profile_dirty_and_uncommitted() -> None:
    engine = get_engine()
    now = datetime(2026, 7, 30, 12, tzinfo=UTC)
    with Session(engine) as setup:
        user = persisted_user(setup)
        delete_conversation = AiConversation(user_id=user.id)
        stale_conversation = AiConversation(
            user_id=user.id,
            created_at=now - timedelta(days=2),
            updated_at=now - timedelta(days=2),
        )
        profile = UserProfile(user_id=user.id, nickname="原昵称")
        setup.add_all([delete_conversation, stale_conversation, profile])
        setup.flush()
        user_id = user.id
        delete_conversation_id = delete_conversation.id
        setup.commit()

    def assert_observer_sees_original() -> None:
        with Session(engine) as observer:
            profile = observer.get(UserProfile, user_id)
            assert profile is not None
            assert profile.nickname == "原昵称"

    try:
        with Session(engine) as deleting:
            user = deleting.get(User, user_id)
            profile = deleting.get(UserProfile, user_id)
            assert user is not None
            assert profile is not None
            profile.nickname = "删除中待保存"
            conversations.delete_conversation(
                session=deleting,
                user=user,
                conversation_id=delete_conversation_id,
            )
            assert deleting.is_modified(profile)
            assert_observer_sees_original()
            deleting.rollback()

        with Session(engine) as cleaning:
            user = cleaning.get(User, user_id)
            profile = cleaning.get(UserProfile, user_id)
            assert user is not None
            assert profile is not None
            profile.nickname = "清理中待保存"
            assert conversations.cleanup_stale_empty_conversations(
                session=cleaning, user=user, now=now
            ) == 1
            assert cleaning.is_modified(profile)
            assert_observer_sees_original()
            cleaning.rollback()
    finally:
        with Session(engine) as cleanup:
            user = cleanup.get(User, user_id)
            if user is not None:
                cleanup.delete(user)
                cleanup.commit()


def test_concurrent_exchange_saves_allocate_unique_chronological_messages() -> None:
    engine = get_engine()
    now = datetime(2026, 7, 29, 12, tzinfo=UTC)
    with Session(engine) as setup:
        user = persisted_user(setup)
        conversation = AiConversation(user_id=user.id)
        setup.add(conversation)
        setup.flush()
        requests = [
            normal_request(setup, user=user, conversation=conversation)
            for _ in range(2)
        ]
        user_id = user.id
        conversation_id = conversation.id
        request_ids = [request.id for request in requests]
        setup.commit()

    barrier = Barrier(2)

    def save_in_own_transaction(index: int) -> None:
        with Session(engine) as session:
            user = session.get(User, user_id)
            assert user is not None
            barrier.wait(timeout=5)
            conversations.save_exchange(
                session=session,
                user=user,
                conversation_id=conversation_id,
                request_id=request_ids[index],
                user_content=f"用户消息 {index}",
                assistant_content=f"助手消息 {index}",
                reviewed_recipe_ids=[],
                user_safety_label=AiSafetyLabel.SAFE,
                assistant_safety_label=AiSafetyLabel.SAFE,
                now=now,
            )
            session.commit()

    executor = ThreadPoolExecutor(max_workers=2)
    try:
        list(executor.map(save_in_own_transaction, range(2)))
        with Session(engine) as verify:
            messages = sorted(
                verify.exec(
                select(AiMessage)
                .where(AiMessage.conversation_id == conversation_id)
                ).all(),
                key=lambda message: (message.created_at, message.id),
            )
        assert [message.role for message in messages] == [
            AiMessageRole.USER,
            AiMessageRole.ASSISTANT,
            AiMessageRole.USER,
            AiMessageRole.ASSISTANT,
        ]
        assert len({message.created_at for message in messages}) == 4
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
        with Session(engine) as cleanup:
            user = cleanup.get(User, user_id)
            if user is not None:
                cleanup.delete(user)
                cleanup.commit()


def test_concurrent_stale_cleanup_deletes_each_conversation_once() -> None:
    engine = get_engine()
    now = datetime(2026, 7, 30, 12, tzinfo=UTC)
    with Session(engine) as setup:
        user = persisted_user(setup)
        conversation = AiConversation(
            user_id=user.id,
            created_at=now - timedelta(days=2),
            updated_at=now - timedelta(days=2),
        )
        setup.add(conversation)
        setup.flush()
        user_id = user.id
        conversation_id = conversation.id
        setup.commit()

    barrier = Barrier(2)

    def cleanup_in_own_transaction() -> int:
        with Session(engine) as session:
            user = session.get(User, user_id)
            assert user is not None
            barrier.wait(timeout=5)
            deleted = conversations.cleanup_stale_empty_conversations(
                session=session, user=user, now=now, limit=1
            )
            session.commit()
            return deleted

    executor = ThreadPoolExecutor(max_workers=2)
    try:
        outcomes = list(executor.map(lambda _: cleanup_in_own_transaction(), range(2)))
        with Session(engine) as verify:
            assert verify.get(AiConversation, conversation_id) is None
        assert sorted(outcomes) == [0, 1]
    finally:
        executor.shutdown(wait=True, cancel_futures=True)
        with Session(engine) as cleanup:
            user = cleanup.get(User, user_id)
            if user is not None:
                cleanup.delete(user)
                cleanup.commit()


def test_bulk_source_cleanup_keeps_shared_memory_and_deletes_orphans_without_tombstones(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    first = AiConversation(user_id=user.id)
    second = AiConversation(user_id=user.id)
    retained = AiConversation(user_id=user.id)
    database_session.add_all([first, second, retained])
    database_session.flush()
    messages = [
        AiMessage(
            conversation_id=conversation.id,
            user_id=user.id,
            role=AiMessageRole.USER,
            content=f"来源 {index}",
        )
        for index, conversation in enumerate([first, second, retained])
    ]
    database_session.add_all(messages)
    database_session.flush()
    orphan = AiMemory(
        user_id=user.id,
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="batch-orphan",
        summary="偏好低甜",
    )
    shared = AiMemory(
        user_id=user.id,
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="batch-shared",
        summary="偏好清爽",
    )
    database_session.add_all([orphan, shared])
    database_session.flush()
    database_session.add_all(
        [
            AiMemorySource(
                memory_id=orphan.id,
                conversation_id=first.id,
                source_message_id=messages[0].id,
            ),
            *[
                AiMemorySource(
                    memory_id=shared.id,
                    conversation_id=conversation.id,
                    source_message_id=message.id,
                )
                for conversation, message in zip(
                    [first, second, retained], messages, strict=True
                )
            ],
        ]
    )
    database_session.flush()
    orphan_id = orphan.id
    shared_id = shared.id
    retained_id = retained.id

    remove_conversation_memory_sources_bulk(
        session=database_session,
        user_id=user.id,
        conversation_ids=[second.id, first.id],
    )
    database_session.expire_all()

    assert database_session.get(AiMemory, orphan_id) is None
    assert database_session.get(AiMemory, shared_id) is not None
    assert database_session.exec(
        select(AiMemorySource).where(AiMemorySource.memory_id == shared_id)
    ).one().conversation_id == retained_id


def _cleanup_statement_counts(*, candidate_count: int) -> Counter[str]:
    engine = get_engine()
    now = datetime(2026, 7, 30, 12, tzinfo=UTC)
    with Session(engine) as setup:
        user = persisted_user(setup, f"cleanup-count-{candidate_count}")
        setup.add_all(
            [
                AiConversation(
                    user_id=user.id,
                    created_at=now - timedelta(days=2),
                    updated_at=now - timedelta(days=2),
                )
                for _ in range(candidate_count)
            ]
        )
        setup.flush()
        user_id = user.id
        setup.commit()

    counts: Counter[str] = Counter()

    def count_statement(
        _: object,
        __: object,
        statement: str,
        ___: object,
        ____: object,
        _____: bool,
    ) -> None:
        operation = statement.lstrip().split(maxsplit=1)[0].upper()
        if operation in {"SELECT", "DELETE"}:
            counts[operation] += 1

    try:
        with Session(engine) as session:
            user = session.get(User, user_id)
            assert user is not None
            event.listen(engine, "before_cursor_execute", count_statement)
            try:
                assert conversations.cleanup_stale_empty_conversations(
                    session=session,
                    user=user,
                    now=now,
                    limit=candidate_count,
                ) == candidate_count
                session.commit()
            finally:
                event.remove(engine, "before_cursor_execute", count_statement)
    finally:
        with Session(engine) as cleanup:
            user = cleanup.get(User, user_id)
            if user is not None:
                cleanup.delete(user)
                cleanup.commit()
    return counts


def test_stale_cleanup_query_count_is_constant_across_batch_sizes() -> None:
    one_candidate = _cleanup_statement_counts(candidate_count=1)
    hundred_candidates = _cleanup_statement_counts(candidate_count=100)

    assert hundred_candidates["SELECT"] - one_candidate["SELECT"] <= 1
    assert hundred_candidates["DELETE"] - one_candidate["DELETE"] <= 1
    assert hundred_candidates["SELECT"] <= 5
    assert hundred_candidates["DELETE"] <= 2
