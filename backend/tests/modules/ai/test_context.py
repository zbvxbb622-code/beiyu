from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlmodel import Session

from app.core.config import Settings
from app.db.models import (
    AiConversation,
    AiMemory,
    AiMemoryCategory,
    AiMessage,
    AiMessageRole,
    CellarItem,
    ContentStatus,
    Recipe,
    User,
)
from app.modules.ai.context import (
    PERSONA_PROMPT,
    build_normal_generation_request,
    build_temporary_generation_request,
    derive_conversation_title,
)
from app.modules.ai.safety import classify_input
from app.modules.ai.schemas import TemporaryContextMessage


def persisted_user(session: Session, suffix: str) -> User:
    user = User(phone_hash=f"context-{suffix}", phone_masked="+86138****0000")
    session.add(user)
    session.flush()
    return user


def settings() -> Settings:
    return Settings(database_url="postgresql+psycopg://user:pass@db/beiyu")


def test_normal_context_is_owned_ordered_and_uses_only_active_published_records(
    database_session: Session,
) -> None:
    owner = persisted_user(database_session, "owner")
    other = persisted_user(database_session, "other")
    conversation = AiConversation(user_id=owner.id)
    other_conversation = AiConversation(user_id=other.id)
    database_session.add_all([conversation, other_conversation])
    database_session.flush()
    now = datetime(2026, 7, 29, 8, tzinfo=UTC)
    database_session.add_all(
        [
            AiMemory(
                user_id=owner.id,
                category=AiMemoryCategory.DRINK_PREFERENCE,
                memory_key="fresh",
                summary="偏好清爽",
                updated_at=now,
            ),
            AiMemory(
                user_id=other.id,
                category=AiMemoryCategory.DRINK_PREFERENCE,
                memory_key="foreign",
                summary="别人的偏好",
                updated_at=now + timedelta(seconds=1),
            ),
            AiMessage(
                user_id=owner.id,
                conversation_id=conversation.id,
                role=AiMessageRole.USER,
                content="最早的消息",
                created_at=now,
            ),
            AiMessage(
                user_id=owner.id,
                conversation_id=conversation.id,
                role=AiMessageRole.ASSISTANT,
                content="后来的消息",
                created_at=now + timedelta(seconds=1),
            ),
            AiMessage(
                user_id=other.id,
                conversation_id=other_conversation.id,
                role=AiMessageRole.USER,
                content="他人的消息",
                created_at=now + timedelta(seconds=2),
            ),
            CellarItem(user_id=owner.id, ingredient_key="gin"),
            CellarItem(user_id=owner.id, ingredient_key="vodka", deleted_at=now),
            Recipe(
                public_id=f"published-{uuid4()}",
                status=ContentStatus.PUBLISHED,
                name="已发布酒谱",
                english_name="Published",
                description="清爽",
                published_at=now,
            ),
            Recipe(
                public_id=f"draft-{uuid4()}",
                status=ContentStatus.DRAFT,
                name="草稿酒谱",
                english_name="Draft",
                description="不应出现",
            ),
        ]
    )
    database_session.flush()

    request = build_normal_generation_request(
        database_session,
        owner,
        conversation,
        "现在想喝点清爽的",
        classify_input("现在想喝点清爽的", owner),
        settings(),
    )

    assert request.system_prompt == PERSONA_PROMPT
    assert request.memories == ["偏好清爽"]
    assert [(message.role, message.content) for message in request.messages] == [
        ("user", "最早的消息"),
        ("assistant", "后来的消息"),
        ("user", "现在想喝点清爽的"),
    ]
    assert request.cellar_ingredient_ids == ["gin"]
    assert [recipe.name for recipe in request.candidate_recipes] == ["已发布酒谱"]
    assert "他人的消息" not in request.context_text
    assert "别人的偏好" not in request.context_text
    assert "草稿酒谱" not in request.context_text
    assert request.context_text.index(PERSONA_PROMPT) < request.context_text.index("偏好清爽")
    assert request.context_text.index("偏好清爽") < request.context_text.index("最早的消息")
    assert request.context_text.index("后来的消息") < request.context_text.index("gin")
    assert request.context_text.index("gin") < request.context_text.index("已发布酒谱")
    assert request.context_text.index("已发布酒谱") < request.context_text.index("现在想喝点清爽的")


def test_temporary_context_never_reads_normal_history_or_memories(
    database_session: Session,
) -> None:
    user = persisted_user(database_session, "temporary")
    conversation = AiConversation(user_id=user.id)
    database_session.add(conversation)
    database_session.flush()
    database_session.add_all(
        [
            AiMemory(
                user_id=user.id,
                category=AiMemoryCategory.EMOTIONAL_PREFERENCE,
                memory_key="listen",
                summary="希望先被倾听",
            ),
            AiMessage(
                user_id=user.id,
                conversation_id=conversation.id,
                role=AiMessageRole.USER,
                content="普通会话历史",
            ),
        ]
    )
    database_session.flush()

    request = build_temporary_generation_request(
        database_session,
        user,
        "继续刚才的话题",
        [TemporaryContextMessage(role=AiMessageRole.USER, content="临时上下文")],
        classify_input("继续刚才的话题", user),
        settings(),
    )

    assert request.memories == []
    assert [(message.role, message.content) for message in request.messages] == [
        ("user", "临时上下文"),
        ("user", "继续刚才的话题"),
    ]
    assert "普通会话历史" not in request.context_text
    assert "希望先被倾听" not in request.context_text


def test_title_is_trimmed_single_line_bounded_and_never_repeats_private_identifiers() -> None:
    assert derive_conversation_title(" \n 今天   想喝点清爽的 \t ") == "今天 想喝点清爽的"
    assert derive_conversation_title("a" * 70) == "a" * 60
    assert derive_conversation_title("清" * 31) == "清" * 30
    assert derive_conversation_title("我的手机号是13800138000，想喝一杯") == "新的对话"
