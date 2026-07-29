from datetime import UTC, datetime, timedelta
from uuid import uuid4

from sqlalchemy import event
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
    MAX_PROVIDER_CONTEXT_CHARS,
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


def test_memory_disabled_skips_ai_memories_query_entirely(database_session: Session) -> None:
    user = persisted_user(database_session, "memory-disabled")
    user.memory_enabled = False
    conversation = AiConversation(user_id=user.id)
    database_session.add(conversation)
    database_session.flush()
    statements: list[str] = []

    def capture(_: object, __: object, statement: str, ___: object, ____: object, _____: object) -> None:
        statements.append(statement)

    connection = database_session.connection()
    event.listen(connection, "before_cursor_execute", capture)
    try:
        request = build_normal_generation_request(
            database_session,
            user,
            conversation,
            "想聊聊",
            classify_input("想聊聊", user),
            settings(),
        )
    finally:
        event.remove(connection, "before_cursor_execute", capture)

    assert request.memories == []
    assert not any("ai_memories" in statement for statement in statements)


def test_context_budget_preserves_persona_current_and_recent_assistant_without_validation_error(
    database_session: Session,
) -> None:
    user = persisted_user(database_session, "budget-normal")
    conversation = AiConversation(user_id=user.id)
    database_session.add(conversation)
    database_session.flush()
    database_session.add_all(
        [
            AiMessage(
                user_id=user.id,
                conversation_id=conversation.id,
                role=AiMessageRole.USER,
                content="旧消息" * 300,
                created_at=datetime(2026, 7, 29, 8, tzinfo=UTC),
            ),
            AiMessage(
                user_id=user.id,
                conversation_id=conversation.id,
                role=AiMessageRole.ASSISTANT,
                content="最近助手回复" * 1_000,
                created_at=datetime(2026, 7, 29, 9, tzinfo=UTC),
            ),
        ]
    )
    database_session.flush()

    request = build_normal_generation_request(
        database_session,
        user,
        conversation,
        "当前消息" * 400,
        classify_input("当前消息", user),
        settings(),
    )

    assert len(request.context_text) <= MAX_PROVIDER_CONTEXT_CHARS
    assert request.system_prompt in request.context_text
    assert request.messages[-1].content == "当前消息" * 400
    assert request.messages[-2].role == "assistant"
    assert request.messages[-2].content == "最近助手回复" * 1_000


def test_private_values_do_not_reach_history_current_generation_request_or_title(
    database_session: Session,
) -> None:
    user = persisted_user(database_session, "private-context")
    conversation = AiConversation(user_id=user.id)
    database_session.add(conversation)
    database_session.flush()
    private_value = "alice@example.com，浙江省杭州市西湖区文三路138号1201室"
    database_session.add(
        AiMessage(
            user_id=user.id,
            conversation_id=conversation.id,
            role=AiMessageRole.ASSISTANT,
            content=f"你刚才写的是{private_value}",
        )
    )
    database_session.flush()

    history_request = build_normal_generation_request(
        database_session,
        user,
        conversation,
        "我们聊点别的",
        classify_input("我们聊点别的", user),
        settings(),
    )
    current_request = build_normal_generation_request(
        database_session,
        user,
        conversation,
        private_value,
        classify_input(private_value, user),
        settings(),
    )

    assert private_value not in history_request.context_text
    assert private_value not in str(history_request.model_dump())
    assert private_value not in current_request.context_text
    assert derive_conversation_title(private_value) == "新的对话"


def test_temporary_context_uses_shared_budget_and_keeps_newest_messages(
    database_session: Session,
) -> None:
    user = persisted_user(database_session, "budget-temporary")
    temporary_context = [
        TemporaryContextMessage(role=AiMessageRole.USER, content=f"{i}" + "旧" * 1_999)
        for i in range(6)
    ]

    request = build_temporary_generation_request(
        database_session,
        user,
        "当前消息" * 400,
        temporary_context,
        classify_input("当前消息", user),
        settings(),
    )

    assert len(request.context_text) <= MAX_PROVIDER_CONTEXT_CHARS
    assert request.messages[-1].content == "当前消息" * 400
    assert request.messages[-2].content == temporary_context[-1].content
    assert temporary_context[0].content not in [message.content for message in request.messages]


def test_context_budget_never_includes_partial_cellar_ids_or_recipe_candidates(
    database_session: Session,
) -> None:
    user = persisted_user(database_session, "budget-candidates")
    conversation = AiConversation(user_id=user.id)
    database_session.add(conversation)
    database_session.flush()
    cellar_ids = [f"ingredient-{index}-" + "x" * 60 for index in range(30)]
    database_session.add_all(
        [CellarItem(user_id=user.id, ingredient_key=ingredient_id) for ingredient_id in cellar_ids]
        + [
            Recipe(
                public_id=f"budget-recipe-{index}-{uuid4()}",
                status=ContentStatus.PUBLISHED,
                name=f"候选{index}",
                english_name=f"Candidate {index}",
                description="描述" * 1_000,
                published_at=datetime(2026, 7, 29, 8, tzinfo=UTC),
            )
            for index in range(5)
        ]
    )
    database_session.flush()

    request = build_normal_generation_request(
        database_session,
        user,
        conversation,
        "当前消息" * 500,
        classify_input("当前消息", user),
        settings(),
    )

    assert len(request.context_text) <= MAX_PROVIDER_CONTEXT_CHARS
    assert all(ingredient_id in cellar_ids for ingredient_id in request.cellar_ingredient_ids)
    assert all(str(recipe.id) in request.context_text for recipe in request.candidate_recipes)


def test_title_is_trimmed_single_line_bounded_and_never_repeats_private_identifiers() -> None:
    assert derive_conversation_title(" \n 今天   想喝点清爽的 \t ") == "今天 想喝点清爽的"
    assert derive_conversation_title("a" * 70) == "a" * 60
    assert derive_conversation_title("清" * 31) == "清" * 30
    assert derive_conversation_title("我的手机号是13800138000，想喝一杯") == "新的对话"
