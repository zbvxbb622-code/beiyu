from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from threading import Barrier
from uuid import uuid4

import pytest
from sqlalchemy import func
from sqlmodel import Session, select

from app.core.config import Settings
from app.core.errors import AppError
from app.db.models import (
    AiChatMode,
    AiConversation,
    AiMemory,
    AiMemoryCategory,
    AiMemorySource,
    AiMemoryTombstone,
    AiMessage,
    AiMessageRole,
    User,
)
from app.db.session import get_engine
from app.modules.ai.memory import (
    apply_memory_candidates,
    clear_memories,
    delete_memory,
    list_memories,
    memory_key_hash,
    normalize_memory_key,
    remove_conversation_memory_sources,
    set_memory_enabled,
)
from app.modules.ai.safety import SAFE_DECISION, SafetyDecision
from app.modules.ai.schemas import AiMemoryCandidate, MemoryChangeAction


def memory_settings(*, limit: int = 20) -> Settings:
    return Settings(
        database_url="postgresql+psycopg://user:pass@db/beiyu",
        ai_memory_limit=limit,
        ai_memory_hmac_key="memory-test-secret",
    )


def persisted_user(session: Session, suffix: str = "owner") -> User:
    user = User(
        phone_hash=f"memory-{suffix}-{uuid4().hex}",
        phone_masked="+86138****0000",
    )
    session.add(user)
    session.flush()
    return user


def persisted_source(
    session: Session,
    user: User,
    content: str = "我喜欢清爽、低甜的饮品。",
) -> tuple[AiConversation, AiMessage]:
    conversation = AiConversation(user_id=user.id)
    session.add(conversation)
    session.flush()
    message = AiMessage(
        user_id=user.id,
        conversation_id=conversation.id,
        role=AiMessageRole.USER,
        content=content,
    )
    session.add(message)
    session.flush()
    return conversation, message


def candidate(
    *,
    key: str = "taste:crisp-low-sugar",
    summary: str = "偏好清爽、低甜的饮品",
    category: AiMemoryCategory = AiMemoryCategory.DRINK_PREFERENCE,
    sensitive: bool = False,
) -> AiMemoryCandidate:
    return AiMemoryCandidate(
        category=category,
        memory_key=key,
        summary=summary,
        confidence=0.9,
        sensitive=sensitive,
    )


def apply(
    session: Session,
    user: User,
    conversation: AiConversation,
    message: AiMessage,
    candidates: list[AiMemoryCandidate],
    *,
    safety: SafetyDecision = SAFE_DECISION,
    mode: AiChatMode = AiChatMode.NORMAL,
    settings: Settings | None = None,
):
    return apply_memory_candidates(
        session=session,
        user=user,
        conversation=conversation,
        source_message=message,
        candidates=candidates,
        safety=safety,
        mode=mode,
        settings=settings or memory_settings(),
    )


def test_normalize_memory_key_uses_nfkc_casefold_and_collapsed_whitespace() -> None:
    assert (
        normalize_memory_key("  TASTＥ\u3000 Crisp\nLow\tSugar  ")
        == "taste crisp low sugar"
    )
    assert memory_key_hash("taste crisp low sugar", "secret") == (
        "4ffcba44505a38eddeabc995dbacd833cfcc148a134348702fe4674060a417ab"
    )
    with pytest.raises(ValueError, match="memory key"):
        normalize_memory_key(" \u3000\n\t ")
    with pytest.raises(ValueError, match="memory key"):
        normalize_memory_key("x" * 81)


def test_apply_creates_only_explicit_allowed_normal_memory_with_owned_source(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation, message = persisted_source(database_session, user)

    changes = apply(database_session, user, conversation, message, [candidate()])

    assert [(change.action, change.summary) for change in changes] == [
        (MemoryChangeAction.CREATED, "偏好清爽、低甜的饮品")
    ]
    memory = database_session.exec(
        select(AiMemory).where(AiMemory.user_id == user.id)
    ).one()
    assert memory.memory_key == "taste:crisp-low-sugar"
    source = database_session.exec(
        select(AiMemorySource).where(AiMemorySource.source_message_id == message.id)
    ).one()
    assert source.memory_id == memory.id
    assert source.conversation_id == conversation.id
    assert source.source_message_id == message.id


def test_apply_rejects_inferred_sensitive_and_unsafe_candidates(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation, message = persisted_source(database_session, user, "今天工作很累。")
    unsafe = SafetyDecision(
        label=SAFE_DECISION.label,
        fixed_reply=None,
        allow_recipes=True,
        allow_memory=False,
    )

    assert apply(database_session, user, conversation, message, [candidate()]) == []
    assert (
        apply(
            database_session,
            user,
            conversation,
            message,
            [candidate(sensitive=True)],
        )
        == []
    )
    assert (
        apply(
            database_session,
            user,
            conversation,
            message,
            [candidate(summary="偏好联系电话 138 0012 3456")],
        )
        == []
    )
    assert (
        apply(
            database_session,
            user,
            conversation,
            message,
            [candidate()],
            safety=unsafe,
        )
        == []
    )
    assert (
        database_session.exec(select(AiMemory).where(AiMemory.user_id == user.id)).all()
        == []
    )


def test_apply_rejects_a_preference_the_user_did_not_explicitly_state(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation, message = persisted_source(
        database_session, user, "我喜欢清爽、低甜的饮品。"
    )

    changes = apply(
        database_session,
        user,
        conversation,
        message,
        [candidate(summary="偏好浓郁、甜口的饮品")],
    )

    assert changes == []
    assert (
        database_session.exec(select(AiMemory).where(AiMemory.user_id == user.id)).all()
        == []
    )


def test_apply_rejects_temporary_disabled_and_non_user_sources(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation, message = persisted_source(database_session, user)

    assert (
        apply(
            database_session,
            user,
            conversation,
            message,
            [candidate()],
            mode=AiChatMode.TEMPORARY,
        )
        == []
    )
    set_memory_enabled(session=database_session, user=user, enabled=False)
    assert apply(database_session, user, conversation, message, [candidate()]) == []
    user.memory_enabled = True
    message.role = AiMessageRole.ASSISTANT
    assert apply(database_session, user, conversation, message, [candidate()]) == []
    assert (
        database_session.exec(select(AiMemory).where(AiMemory.user_id == user.id)).all()
        == []
    )


def test_same_normalized_key_updates_summary_but_unchanged_summary_only_adds_source(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation, first_message = persisted_source(database_session, user)
    second_message = AiMessage(
        user_id=user.id,
        conversation_id=conversation.id,
        role=AiMessageRole.USER,
        content="我偏好清爽低甜的饮品。",
    )
    database_session.add(second_message)
    database_session.flush()
    first = apply(
        database_session,
        user,
        conversation,
        first_message,
        [candidate(key="Taste: Crisp")],
    )
    memory = database_session.exec(
        select(AiMemory).where(AiMemory.user_id == user.id)
    ).one()
    original_updated_at = datetime(2026, 7, 29, 8, tzinfo=UTC)
    memory.updated_at = original_updated_at
    database_session.flush()

    unchanged = apply(
        database_session,
        user,
        conversation,
        second_message,
        [candidate(key="  taste:\u3000crisp ")],
    )

    assert first[0].action is MemoryChangeAction.CREATED
    assert unchanged == []
    database_session.refresh(memory)
    assert memory.updated_at == original_updated_at
    assert (
        database_session.exec(
            select(AiMemorySource).where(AiMemorySource.memory_id == memory.id)
        )
        .all()
        .__len__()
        == 2
    )

    third_message = AiMessage(
        user_id=user.id,
        conversation_id=conversation.id,
        role=AiMessageRole.USER,
        content="我偏好清爽、低甜、柑橘感的饮品。",
    )
    database_session.add(third_message)
    database_session.flush()
    changed = apply(
        database_session,
        user,
        conversation,
        third_message,
        [candidate(key="taste: crisp", summary="偏好清爽、低甜、柑橘感的饮品")],
    )

    assert [(change.action, change.summary) for change in changed] == [
        (MemoryChangeAction.UPDATED, "偏好清爽、低甜、柑橘感的饮品")
    ]
    assert (
        database_session.exec(
            select(func.count())
            .select_from(AiMemory)
            .where(AiMemory.user_id == user.id)
        ).one()
        == 1
    )


def test_disabling_memory_preserves_existing_rows_but_stops_new_candidates(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation, first_message = persisted_source(database_session, user)
    apply(database_session, user, conversation, first_message, [candidate()])

    set_memory_enabled(session=database_session, user=user, enabled=False)
    second_message = AiMessage(
        user_id=user.id,
        conversation_id=conversation.id,
        role=AiMessageRole.USER,
        content="我喜欢清爽、低甜、柑橘感的饮品。",
    )
    database_session.add(second_message)
    database_session.flush()

    assert [memory.summary for memory in list_memories(database_session, user)] == [
        "偏好清爽、低甜的饮品"
    ]
    assert (
        apply(
            database_session,
            user,
            conversation,
            second_message,
            [
                candidate(
                    key="taste:citrus",
                    summary="偏好清爽、低甜、柑橘感的饮品",
                )
            ],
        )
        == []
    )


def test_existing_memory_can_update_at_limit_but_new_key_is_stably_skipped(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation, message = persisted_source(database_session, user)
    database_session.add_all(
        [
            AiMemory(
                user_id=user.id,
                category=AiMemoryCategory.DRINK_PREFERENCE,
                memory_key=f"taste:{index}",
                summary=f"偏好{index}",
            )
            for index in range(2)
        ]
    )
    database_session.flush()

    changes = apply(
        database_session,
        user,
        conversation,
        message,
        [
            candidate(key="taste:0", summary="我偏好0，也喜欢清爽、低甜的饮品"),
            candidate(key="taste:new", summary="偏好清爽、低甜的饮品"),
        ],
        settings=memory_settings(limit=2),
    )

    assert [(change.action, change.summary) for change in changes] == [
        (MemoryChangeAction.UPDATED, "我偏好0，也喜欢清爽、低甜的饮品")
    ]
    assert (
        database_session.exec(
            select(func.count())
            .select_from(AiMemory)
            .where(AiMemory.user_id == user.id)
        ).one()
        == 2
    )
    assert (
        database_session.exec(
            select(AiMemory).where(
                AiMemory.user_id == user.id,
                AiMemory.memory_key == "taste:new",
            )
        ).first()
        is None
    )


def test_list_memories_is_owned_stably_sorted_and_hides_internal_fields(
    database_session: Session,
) -> None:
    user = persisted_user(database_session, "owner")
    other = persisted_user(database_session, "other")
    earlier = datetime(2026, 7, 29, 8, tzinfo=UTC)
    database_session.add_all(
        [
            AiMemory(
                user_id=user.id,
                category=AiMemoryCategory.DRINK_PREFERENCE,
                memory_key="early",
                summary="早",
                updated_at=earlier,
            ),
            AiMemory(
                user_id=user.id,
                category=AiMemoryCategory.DRINK_PREFERENCE,
                memory_key="late",
                summary="晚",
                updated_at=earlier + timedelta(seconds=1),
            ),
            AiMemory(
                user_id=other.id,
                category=AiMemoryCategory.DRINK_PREFERENCE,
                memory_key="foreign",
                summary="他人",
            ),
        ]
    )
    database_session.flush()

    memories = list_memories(session=database_session, user=user)

    assert [memory.summary for memory in memories] == ["晚", "早"]
    assert set(memories[0].model_dump()) == {"id", "category", "summary", "createdAt"}


def test_delete_creates_tombstone_before_removing_only_owned_memory_and_is_idempotent(
    database_session: Session,
) -> None:
    user = persisted_user(database_session, "owner")
    other = persisted_user(database_session, "other")
    conversation, message = persisted_source(database_session, user)
    apply(database_session, user, conversation, message, [candidate()])
    memory = database_session.exec(
        select(AiMemory).where(AiMemory.user_id == user.id)
    ).one()
    foreign = AiMemory(
        user_id=other.id,
        category=AiMemoryCategory.DRINK_PREFERENCE,
        memory_key="foreign",
        summary="他人的偏好",
    )
    database_session.add(foreign)
    database_session.flush()

    delete_memory(
        session=database_session,
        user=user,
        memory_id=memory.id,
        settings=memory_settings(),
    )
    delete_memory(
        session=database_session,
        user=user,
        memory_id=memory.id,
        settings=memory_settings(),
    )

    assert database_session.get(AiMemory, memory.id) is None
    tombstone = database_session.exec(
        select(AiMemoryTombstone).where(AiMemoryTombstone.user_id == user.id)
    ).one()
    assert tombstone.key_hash == memory_key_hash(
        "taste:crisp-low-sugar", "memory-test-secret"
    )
    assert database_session.get(AiMemory, foreign.id) is not None
    with pytest.raises(AppError) as exc_info:
        delete_memory(
            session=database_session,
            user=user,
            memory_id=foreign.id,
            settings=memory_settings(),
        )
    assert (exc_info.value.code, exc_info.value.status_code) == (
        "AI_MEMORY_NOT_FOUND",
        404,
    )


def test_tombstone_suppresses_old_candidate_and_clear_tombstones_every_key(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    conversation, first_message = persisted_source(database_session, user)
    apply(database_session, user, conversation, first_message, [candidate()])
    memory = database_session.exec(
        select(AiMemory).where(AiMemory.user_id == user.id)
    ).one()
    delete_memory(
        session=database_session,
        user=user,
        memory_id=memory.id,
        settings=memory_settings(),
    )
    next_message = AiMessage(
        user_id=user.id,
        conversation_id=conversation.id,
        role=AiMessageRole.USER,
        content="我喜欢清爽、低甜的饮品。",
    )
    database_session.add(next_message)
    database_session.flush()

    assert (
        apply(database_session, user, conversation, next_message, [candidate()]) == []
    )
    database_session.add(
        AiMemory(
            user_id=user.id,
            category=AiMemoryCategory.EMOTIONAL_PREFERENCE,
            memory_key="listen",
            summary="偏好被耐心倾听",
        )
    )
    database_session.flush()
    clear_memories(session=database_session, user=user, settings=memory_settings())
    clear_memories(session=database_session, user=user, settings=memory_settings())

    assert (
        database_session.exec(select(AiMemory).where(AiMemory.user_id == user.id)).all()
        == []
    )
    assert (
        database_session.exec(
            select(func.count())
            .select_from(AiMemoryTombstone)
            .where(AiMemoryTombstone.user_id == user.id)
        ).one()
        == 2
    )


def test_removing_conversation_sources_keeps_shared_memory_and_deletes_orphans_without_tombstone(
    database_session: Session,
) -> None:
    user = persisted_user(database_session)
    first_conversation, first_message = persisted_source(database_session, user)
    second_conversation, second_message = persisted_source(database_session, user)
    apply(database_session, user, first_conversation, first_message, [candidate()])
    apply(database_session, user, second_conversation, second_message, [candidate()])
    memory = database_session.exec(
        select(AiMemory).where(AiMemory.user_id == user.id)
    ).one()

    remove_conversation_memory_sources(
        session=database_session, conversation=first_conversation
    )
    assert database_session.get(AiMemory, memory.id) is not None
    assert (
        database_session.exec(
            select(AiMemorySource).where(AiMemorySource.memory_id == memory.id)
        )
        .one()
        .conversation_id
        == second_conversation.id
    )

    remove_conversation_memory_sources(
        session=database_session, conversation=second_conversation
    )
    assert database_session.get(AiMemory, memory.id) is None
    assert (
        database_session.exec(
            select(AiMemoryTombstone).where(AiMemoryTombstone.user_id == user.id)
        ).all()
        == []
    )


def test_apply_concurrently_never_exceeds_memory_limit(
    database_session: Session,
) -> None:
    del database_session
    with Session(get_engine()) as setup_session:
        user = persisted_user(setup_session)
        user_id = user.id
        setup_session.commit()
    barrier = Barrier(2)

    def worker(index: int) -> None:
        with Session(get_engine()) as session:
            owned_user = session.get(User, user_id)
            assert owned_user is not None
            conversation, message = persisted_source(
                session,
                owned_user,
                f"我喜欢清爽、低甜的饮品 {index}。",
            )
            session.commit()
            barrier.wait()
            apply(
                session,
                owned_user,
                conversation,
                message,
                [candidate(key=f"taste:{index}")],
                settings=memory_settings(limit=1),
            )
            session.commit()

    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(worker, range(2)))

    with Session(get_engine()) as observer:
        count = observer.exec(
            select(func.count())
            .select_from(AiMemory)
            .where(AiMemory.user_id == user_id)
        ).one()
        owned_user = observer.get(User, user_id)
        assert owned_user is not None
        observer.delete(owned_user)
        observer.commit()
    assert count == 1


def test_apply_concurrently_merges_the_same_normalized_key(
    database_session: Session,
) -> None:
    del database_session
    with Session(get_engine()) as setup_session:
        user = persisted_user(setup_session)
        user_id = user.id
        setup_session.commit()
    barrier = Barrier(2)

    def worker(index: int) -> None:
        with Session(get_engine()) as session:
            owned_user = session.get(User, user_id)
            assert owned_user is not None
            conversation, message = persisted_source(
                session,
                owned_user,
                "我喜欢清爽、低甜的饮品。",
            )
            session.commit()
            barrier.wait()
            apply(
                session,
                owned_user,
                conversation,
                message,
                [
                    candidate(
                        key=("Taste: Crisp" if index == 0 else " taste:\u3000crisp ")
                    )
                ],
            )
            session.commit()

    with ThreadPoolExecutor(max_workers=2) as executor:
        list(executor.map(worker, range(2)))

    with Session(get_engine()) as observer:
        memories = observer.exec(
            select(AiMemory).where(AiMemory.user_id == user_id)
        ).all()
        sources = observer.exec(
            select(AiMemorySource).where(AiMemorySource.memory_id == memories[0].id)
        ).all()
        owned_user = observer.get(User, user_id)
        assert owned_user is not None
        observer.delete(owned_user)
        observer.commit()
    assert len(memories) == 1
    assert len(sources) == 2
