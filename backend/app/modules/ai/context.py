import re
from typing import Any, cast

from sqlalchemy import ColumnElement
from sqlmodel import Session, select

from app.core.config import Settings
from app.db.models import (
    AiConversation,
    AiMemory,
    AiMessage,
    CellarItem,
    ContentStatus,
    Recipe,
    User,
)
from app.modules.ai.safety import (
    SafetyDecision,
    contains_private_identifiers,
    redact_private_identifiers,
)
from app.modules.ai.schemas import (
    AiGenerationMessage,
    AiGenerationRequest,
    AiRecipeCandidate,
    TemporaryContextMessage,
)

PERSONA_PROMPT = (
    "你是北屿的调酒聊天伙伴：温柔、自然、克制，像懂调酒的朋友。"
    "先回应情绪，再回应问题；默认用两到五句。"
    "不宣称自己是真人或治疗师，不诱导用户依赖你替代现实关系，"
    "也不把酒精描述成解决痛苦的方法。"
)
DEFAULT_CONVERSATION_TITLE = "新的对话"
MAX_CONTEXT_MESSAGES = 20
MAX_MEMORY_ITEMS = 20
MAX_RECIPE_CANDIDATES = 5
REDACTED_CURRENT_MESSAGE = "[用户消息含敏感身份信息，未提供给模型]"
WHITESPACE_PATTERN = re.compile(r"\s+")


def _context_text(
    *,
    memories: list[str],
    messages: list[AiGenerationMessage],
    cellar_ingredient_ids: list[str],
    candidate_recipes: list[AiRecipeCandidate],
) -> str:
    sections = [f"人设：{PERSONA_PROMPT}"]
    sections.append("有效记忆：" + ("；".join(memories) if memories else "无"))
    sections.append(
        "最近消息："
        + ("\n".join(f"{message.role}: {message.content}" for message in messages[:-1]) or "无")
    )
    sections.append("酒柜配料编号：" + ("、".join(cellar_ingredient_ids) or "无"))
    sections.append(
        "已发布候选酒谱："
        + (
            "；".join(f"{recipe.id} {recipe.name}" for recipe in candidate_recipes)
            if candidate_recipes
            else "无"
        )
    )
    sections.append(f"当前用户消息：{messages[-1].content}")
    return "\n".join(sections)


def _current_message(content: str, safety: SafetyDecision) -> str:
    trimmed = content.strip()
    if safety.fixed_reply is not None or contains_private_identifiers(trimmed):
        return REDACTED_CURRENT_MESSAGE
    return redact_private_identifiers(trimmed)


def _cellar_ingredient_ids(session: Session, user: User) -> list[str]:
    deleted_at = cast(ColumnElement[Any], CellarItem.deleted_at)
    ingredient_key = cast(ColumnElement[Any], CellarItem.ingredient_key)
    return list(
        session.exec(
            select(CellarItem.ingredient_key)
            .where(
                CellarItem.user_id == user.id,
                deleted_at.is_(None),
                ingredient_key.is_not(None),
            )
            .order_by(ingredient_key)
        ).all()
    )


def _candidate_recipes(session: Session, allow_recipes: bool) -> list[AiRecipeCandidate]:
    if not allow_recipes:
        return []
    published_at = cast(ColumnElement[Any], Recipe.published_at)
    recipe_id = cast(ColumnElement[Any], Recipe.id)
    recipes = session.exec(
        select(Recipe)
        .where(Recipe.status == ContentStatus.PUBLISHED)
        .order_by(published_at.desc(), recipe_id)
        .limit(MAX_RECIPE_CANDIDATES)
    ).all()
    return [
        AiRecipeCandidate(
            id=recipe.id,
            name=recipe.name,
            description=recipe.description,
            tags=recipe.tags,
        )
        for recipe in recipes
    ]


def _request(
    *,
    messages: list[AiGenerationMessage],
    memories: list[str],
    cellar_ingredient_ids: list[str],
    candidate_recipes: list[AiRecipeCandidate],
) -> AiGenerationRequest:
    return AiGenerationRequest(
        system_prompt=PERSONA_PROMPT,
        messages=messages,
        memories=memories,
        cellar_ingredient_ids=cellar_ingredient_ids,
        candidate_recipes=candidate_recipes,
        max_output_chars=8_000,
        context_text=_context_text(
            memories=memories,
            messages=messages,
            cellar_ingredient_ids=cellar_ingredient_ids,
            candidate_recipes=candidate_recipes,
        ),
    )


def build_normal_generation_request(
    session: Session,
    user: User,
    conversation: AiConversation,
    content: str,
    safety: SafetyDecision,
    settings: Settings,
) -> AiGenerationRequest:
    if conversation.user_id != user.id:
        raise ValueError("conversation does not belong to user")
    memory_limit = min(settings.ai_memory_limit, MAX_MEMORY_ITEMS)
    memory_updated_at = cast(ColumnElement[Any], AiMemory.updated_at)
    memory_id = cast(ColumnElement[Any], AiMemory.id)
    memories = list(
        session.exec(
            select(AiMemory.summary)
            .where(AiMemory.user_id == user.id)
            .order_by(memory_updated_at.desc(), memory_id)
            .limit(memory_limit)
        ).all()
    )
    message_limit = min(settings.ai_context_messages, MAX_CONTEXT_MESSAGES)
    message_created_at = cast(ColumnElement[Any], AiMessage.created_at)
    message_id = cast(ColumnElement[Any], AiMessage.id)
    recent_messages = session.exec(
        select(AiMessage)
        .where(
            AiMessage.user_id == user.id,
            AiMessage.conversation_id == conversation.id,
        )
        .order_by(message_created_at.desc(), message_id.desc())
        .limit(message_limit)
    ).all()
    messages = [
        AiGenerationMessage(
            role="user" if message.role.value == "USER" else "assistant",
            content=redact_private_identifiers(message.content),
        )
        for message in reversed(recent_messages)
    ]
    messages.append(AiGenerationMessage(role="user", content=_current_message(content, safety)))
    cellar_ingredient_ids = _cellar_ingredient_ids(session, user)
    candidate_recipes = _candidate_recipes(session, safety.allow_recipes)
    return _request(
        messages=messages,
        memories=[redact_private_identifiers(str(summary)) for summary in memories],
        cellar_ingredient_ids=cellar_ingredient_ids,
        candidate_recipes=candidate_recipes,
    )


def build_temporary_generation_request(
    session: Session,
    user: User,
    content: str,
    temporary_context: list[TemporaryContextMessage],
    safety: SafetyDecision,
    settings: Settings,
) -> AiGenerationRequest:
    del settings
    if len(temporary_context) > MAX_CONTEXT_MESSAGES:
        raise ValueError("temporary context exceeds message budget")
    character_count = sum(
        len(message.role.value) + len(message.content) for message in temporary_context
    )
    if character_count > 12_000:
        raise ValueError("temporary context exceeds character budget")
    messages = [
        AiGenerationMessage(
            role="user" if message.role.value == "USER" else "assistant",
            content=redact_private_identifiers(message.content),
        )
        for message in temporary_context
    ]
    messages.append(AiGenerationMessage(role="user", content=_current_message(content, safety)))
    cellar_ingredient_ids = _cellar_ingredient_ids(session, user)
    candidate_recipes = _candidate_recipes(session, safety.allow_recipes)
    return _request(
        messages=messages,
        memories=[],
        cellar_ingredient_ids=cellar_ingredient_ids,
        candidate_recipes=candidate_recipes,
    )


def derive_conversation_title(content: str) -> str:
    if contains_private_identifiers(content):
        return DEFAULT_CONVERSATION_TITLE
    normalized = WHITESPACE_PATTERN.sub(" ", content).strip()
    if not normalized:
        return DEFAULT_CONVERSATION_TITLE
    return normalized[:60] if normalized.isascii() else normalized[:30]
