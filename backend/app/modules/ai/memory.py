import hashlib
import hmac
import re
from collections.abc import Iterable
from datetime import UTC, datetime
from typing import Any, cast
from uuid import UUID

from sqlalchemy import ColumnElement
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
from app.db.models.accounts import utc_now
from app.modules.ai.safety import (
    ALLOWED_MEMORY_CATEGORIES,
    SafetyDecision,
    canonicalize_safety_text,
    contains_medical_memory_detail,
    contains_private_identifiers,
)
from app.modules.ai.schemas import (
    AiMemoryCandidate,
    AiMemoryResponse,
    MemoryChange,
    MemoryChangeAction,
)

MEMORY_KEY_MAX_LENGTH = 80
MEMORY_SUMMARY_MAX_LENGTH = 240
MEMORY_LIST_MAX_ITEMS = 20
MEMORY_HMAC_DOMAIN = "beiyu-ai-memory-v1:"
WHITESPACE_PATTERN = re.compile(r"\s+")
CJK_TEXT_PATTERN = re.compile(r"[\u4e00-\u9fff]+")
SAFETY_REMINDER_SUMMARY_PATTERN = re.compile(
    r"(?:避免[\u4e00-\u9fffA-Za-z0-9 -]{1,80}|偏好无酒精(?:饮品|选择)?)"
)
EXPLICIT_PREFERENCE_MARKERS = ("喜欢", "偏好", "不喜欢", "不爱", "希望", "想要", "避免")
EXPLICIT_SAFETY_MARKERS = ("避免", "不要", "不能", "不喝", "无酒精")
GENERIC_MEMORY_BIGRAMS = frozenset(
    {
        "偏好",
        "喜欢",
        "避免",
        "饮品",
        "口味",
        "味道",
        "希望",
        "想要",
        "不要",
        "不能",
        "无酒",
        "酒精",
    }
)
MEMORY_PROHIBITED_TERMS = (
    "诊断",
    "确诊",
    "抑郁",
    "焦虑症",
    "病史",
    "处方",
    "药物",
    "身份证",
    "银行卡",
    "验证码",
    "住址",
    "地址",
    "学校",
    "公司",
    "自杀",
    "自伤",
)


def _column(value: Any) -> ColumnElement[Any]:
    return cast(ColumnElement[Any], value)


def normalize_memory_key(key: str) -> str:
    """Return the stable database key without retaining raw provider formatting."""
    normalized = _canonical_memory_text(key)
    if not normalized or len(normalized) > MEMORY_KEY_MAX_LENGTH:
        raise ValueError("memory key must be 1 to 80 characters after normalization")
    return normalized


def _canonical_memory_text(value: str) -> str:
    return WHITESPACE_PATTERN.sub(" ", canonicalize_safety_text(value)).strip()


def memory_key_hash(key: str, secret: str) -> str:
    payload = f"{MEMORY_HMAC_DOMAIN}{key}".encode()
    return hmac.new(secret.encode(), payload, hashlib.sha256).hexdigest()


def _memory_response(memory: AiMemory) -> AiMemoryResponse:
    return AiMemoryResponse(
        id=memory.id,
        category=memory.category,
        summary=memory.summary,
        created_at=memory.created_at,
    )


def list_memories(
    session: Session,
    user: User,
    settings: Settings | None = None,
) -> list[AiMemoryResponse]:
    """List only visible fields for the current user in a deterministic order."""
    limit = min(
        settings.ai_memory_limit if settings is not None else MEMORY_LIST_MAX_ITEMS,
        MEMORY_LIST_MAX_ITEMS,
    )
    updated_at = _column(AiMemory.updated_at)
    memory_id = _column(AiMemory.id)
    with session.no_autoflush:
        memories = session.exec(
            select(AiMemory)
            .where(AiMemory.user_id == user.id)
            .order_by(updated_at.desc(), memory_id.desc())
            .limit(limit)
        ).all()
    return [_memory_response(memory) for memory in memories]


def _lock_user(session: Session, user_id: UUID) -> User:
    locked = session.exec(
        select(User)
        .where(User.id == user_id)
        .execution_options(populate_existing=True)
        .with_for_update()
    ).first()
    if locked is None:
        raise AppError(
            code="AI_MEMORY_NOT_FOUND", message="AI 记忆不存在", status_code=404
        )
    return locked


def _candidate_is_explicit_user_expression(
    candidate: AiMemoryCandidate,
    canonical_content: str,
    canonical_summary: str,
) -> bool:
    if not canonical_content or not any(
        marker in canonical_content for marker in ("我", "本人", "自己")
    ):
        return False
    markers = (
        EXPLICIT_SAFETY_MARKERS
        if candidate.category is AiMemoryCategory.SAFETY_REMINDER
        else EXPLICIT_PREFERENCE_MARKERS
    )
    if not any(marker in canonical_content for marker in markers):
        return False
    summary = canonical_summary
    for generic in GENERIC_MEMORY_BIGRAMS:
        summary = summary.replace(generic, "")
    evidence = {
        fragment[index : index + 2]
        for match in CJK_TEXT_PATTERN.finditer(summary)
        for fragment in (match.group().strip("的了和及与也"),)
        for index in range(len(fragment) - 1)
    }
    return bool(
        evidence and any(fragment in canonical_content for fragment in evidence)
    )


def _is_safe_candidate(
    candidate: AiMemoryCandidate,
    *,
    canonical_content: str,
    canonical_key: str,
    canonical_summary: str,
) -> bool:
    canonical_values = (canonical_content, canonical_key, canonical_summary)
    if any(contains_private_identifiers(value) for value in canonical_values):
        return False
    if any(contains_medical_memory_detail(value) for value in canonical_values):
        return False
    if candidate.sensitive or candidate.category not in ALLOWED_MEMORY_CATEGORIES:
        return False
    if candidate.summary != candidate.summary.strip() or not candidate.summary:
        return False
    if len(candidate.summary) > MEMORY_SUMMARY_MAX_LENGTH:
        return False
    if candidate.category is AiMemoryCategory.SAFETY_REMINDER and not SAFETY_REMINDER_SUMMARY_PATTERN.fullmatch(canonical_summary):
        return False
    return not any(term in canonical_summary for term in MEMORY_PROHIBITED_TERMS)


def _locked_owned_normal_source(
    session: Session,
    *,
    user_id: UUID,
    conversation: AiConversation | None,
    source_message: AiMessage | None,
    mode: AiChatMode,
) -> tuple[User, AiConversation, AiMessage] | None:
    if mode is not AiChatMode.NORMAL or conversation is None or source_message is None:
        return None
    locked_user = _lock_user(session, user_id)
    locked_conversation = session.exec(
        select(AiConversation)
        .where(
            AiConversation.id == conversation.id,
            AiConversation.user_id == locked_user.id,
        )
        .with_for_update()
    ).first()
    if locked_conversation is None:
        return None
    locked_message = session.exec(
        select(AiMessage)
        .where(
            AiMessage.id == source_message.id,
            AiMessage.user_id == locked_user.id,
            AiMessage.conversation_id == locked_conversation.id,
            AiMessage.role == AiMessageRole.USER,
        )
        .with_for_update()
    ).first()
    if locked_message is None:
        return None
    return locked_user, locked_conversation, locked_message


def _existing_tombstone_hashes(
    session: Session,
    *,
    user_id: UUID,
    categories_and_hashes: Iterable[tuple[AiMemoryCategory, str]],
) -> set[tuple[AiMemoryCategory, str]]:
    requested = set(categories_and_hashes)
    if not requested:
        return set()
    tombstones = session.exec(
        select(AiMemoryTombstone).where(AiMemoryTombstone.user_id == user_id)
    ).all()
    return {
        (tombstone.category, tombstone.key_hash)
        for tombstone in tombstones
        if (tombstone.category, tombstone.key_hash) in requested
    }


def apply_memory_candidates(
    session: Session,
    user: User,
    conversation: AiConversation | None,
    source_message: AiMessage | None,
    candidates: list[AiMemoryCandidate],
    safety: SafetyDecision,
    mode: AiChatMode,
    settings: Settings,
) -> list[MemoryChange]:
    """Apply reviewed candidates without committing the caller's transaction."""
    if not safety.allow_memory:
        return []
    owned_source = _locked_owned_normal_source(
        session,
        user_id=user.id,
        conversation=conversation,
        source_message=source_message,
        mode=mode,
    )
    if owned_source is None:
        return []
    locked_user, locked_conversation, locked_message = owned_source
    if not locked_user.memory_enabled:
        return []
    canonical_content = _canonical_memory_text(locked_message.content)

    valid_candidates: list[tuple[AiMemoryCandidate, str, str]] = []
    for candidate in candidates:
        try:
            normalized_key = normalize_memory_key(candidate.memory_key)
        except ValueError:
            continue
        canonical_summary = _canonical_memory_text(candidate.summary)
        if not _is_safe_candidate(
            candidate,
            canonical_content=canonical_content,
            canonical_key=normalized_key,
            canonical_summary=canonical_summary,
        ) or not _candidate_is_explicit_user_expression(
            candidate,
            canonical_content,
            canonical_summary,
        ):
            continue
        valid_candidates.append(
            (
                candidate,
                normalized_key,
                memory_key_hash(
                    normalized_key,
                    settings.ai_memory_hmac_key.get_secret_value(),
                ),
            )
        )
    if not valid_candidates:
        return []

    # This serializes a user's concurrent candidate writes, covering both the
    # per-key unique constraint and the configured active-memory cap.
    existing_memories = session.exec(
        select(AiMemory)
        .where(AiMemory.user_id == locked_user.id)
        .with_for_update()
    ).all()
    memories_by_key = {
        (memory.category, memory.memory_key): memory for memory in existing_memories
    }
    tombstones = _existing_tombstone_hashes(
        session,
        user_id=locked_user.id,
        categories_and_hashes=(
            (candidate.category, key_hash)
            for candidate, _, key_hash in valid_candidates
        ),
    )
    source_memory_ids = set(
        session.exec(
            select(AiMemorySource.memory_id)
            .where(AiMemorySource.source_message_id == locked_message.id)
            .with_for_update()
        ).all()
    )
    changes: list[MemoryChange] = []
    now = utc_now()
    for candidate, normalized_key, key_hash in valid_candidates:
        identity = (candidate.category, normalized_key)
        if (candidate.category, key_hash) in tombstones:
            continue
        memory = memories_by_key.get(identity)
        if memory is None:
            if len(memories_by_key) >= settings.ai_memory_limit:
                continue
            memory = AiMemory(
                user_id=locked_user.id,
                category=candidate.category,
                memory_key=normalized_key,
                summary=candidate.summary,
                created_at=now,
                updated_at=now,
            )
            session.add(memory)
            memories_by_key[identity] = memory
            changes.append(
                MemoryChange(
                    id=memory.id,
                    action=MemoryChangeAction.CREATED,
                    category=memory.category,
                    summary=memory.summary,
                )
            )
        elif memory.summary != candidate.summary:
            memory.summary = candidate.summary
            memory.updated_at = now
            session.add(memory)
            changes.append(
                MemoryChange(
                    id=memory.id,
                    action=MemoryChangeAction.UPDATED,
                    category=memory.category,
                    summary=memory.summary,
                )
            )
        if memory.id not in source_memory_ids:
            session.add(
                AiMemorySource(
                    memory_id=memory.id,
                    conversation_id=locked_conversation.id,
                    source_message_id=locked_message.id,
                )
            )
            source_memory_ids.add(memory.id)
    session.flush()
    return changes


def _tombstone_hashes_for_memories(
    *,
    memories: Iterable[AiMemory],
    settings: Settings,
) -> set[tuple[AiMemoryCategory, str]]:
    secret = settings.ai_memory_hmac_key.get_secret_value()
    return {
        (memory.category, memory_key_hash(memory.memory_key, secret))
        for memory in memories
    }


def _add_missing_tombstones(
    session: Session,
    *,
    user_id: UUID,
    hashes: set[tuple[AiMemoryCategory, str]],
) -> None:
    existing = _existing_tombstone_hashes(
        session,
        user_id=user_id,
        categories_and_hashes=hashes,
    )
    for category, key_hash in hashes - existing:
        session.add(
            AiMemoryTombstone(
                user_id=user_id,
                category=category,
                key_hash=key_hash,
            )
        )
    if hashes - existing:
        # Persist tombstones before any source or summary deletion in this
        # caller-owned transaction.
        session.flush()


def _delete_memory_rows(session: Session, memories: Iterable[AiMemory]) -> None:
    memory_list = list(memories)
    if not memory_list:
        return
    memory_ids = [memory.id for memory in memory_list]
    source_memory_id = _column(AiMemorySource.memory_id)
    sources = session.exec(
        select(AiMemorySource).where(source_memory_id.in_(memory_ids))
    ).all()
    for source in sources:
        session.delete(source)
    if sources:
        session.flush()
    for memory in memory_list:
        session.delete(memory)
    session.flush()


def delete_memory(
    session: Session,
    user: User,
    memory_id: UUID,
    settings: Settings,
) -> None:
    """Tombstone an owned memory then remove it and every source, without commit."""
    _lock_user(session, user.id)
    memory = session.get(AiMemory, memory_id)
    if memory is None:
        return
    if memory.user_id != user.id:
        raise AppError(
            code="AI_MEMORY_NOT_FOUND", message="AI 记忆不存在", status_code=404
        )
    _add_missing_tombstones(
        session,
        user_id=user.id,
        hashes=_tombstone_hashes_for_memories(memories=[memory], settings=settings),
    )
    _delete_memory_rows(session, [memory])


def clear_memories(session: Session, user: User, settings: Settings) -> None:
    """Tombstone every current memory, then remove all sources and summaries."""
    _lock_user(session, user.id)
    memories = session.exec(
        select(AiMemory).where(AiMemory.user_id == user.id).with_for_update()
    ).all()
    _add_missing_tombstones(
        session,
        user_id=user.id,
        hashes=_tombstone_hashes_for_memories(memories=memories, settings=settings),
    )
    _delete_memory_rows(session, memories)


def set_memory_enabled(session: Session, user: User, enabled: bool) -> User:
    """Change only the read/write consent flag; disabling never deletes memories."""
    locked_user = _lock_user(session, user.id)
    locked_user.memory_enabled = enabled
    locked_user.updated_at = datetime.now(UTC)
    session.add(locked_user)
    session.flush()
    return locked_user


def remove_conversation_memory_sources(
    session: Session, conversation: AiConversation
) -> None:
    """Remove one conversation's evidence and prune only its orphaned memories."""
    with session.no_autoflush:
        owner_id = session.exec(
            select(AiConversation.user_id).where(AiConversation.id == conversation.id)
        ).first()
    if owner_id is None:
        return
    locked_user = _lock_user(session, owner_id)
    locked_conversation = session.exec(
        select(AiConversation)
        .where(
            AiConversation.id == conversation.id,
            AiConversation.user_id == locked_user.id,
        )
        .with_for_update()
    ).first()
    if locked_conversation is None:
        return
    source_ids = session.exec(
        select(AiMemorySource.memory_id).where(
            AiMemorySource.conversation_id == locked_conversation.id
        )
    ).all()
    if not source_ids:
        return
    memory_id = _column(AiMemory.id)
    memories = session.exec(
        select(AiMemory).where(memory_id.in_(set(source_ids))).with_for_update()
    ).all()
    sources = session.exec(
        select(AiMemorySource)
        .where(AiMemorySource.conversation_id == locked_conversation.id)
        .with_for_update()
    ).all()
    affected_memory_ids = {source.memory_id for source in sources}
    for source in sources:
        session.delete(source)
    session.flush()
    orphan_ids = [
        memory_id
        for memory_id in affected_memory_ids
        if session.exec(
            select(AiMemorySource.id).where(AiMemorySource.memory_id == memory_id)
        ).first()
        is None
    ]
    if not orphan_ids:
        return
    orphans = [memory for memory in memories if memory.id in orphan_ids]
    # Conversation cleanup is intentionally not a user deletion: no tombstones.
    _delete_memory_rows(session, orphans)
