import uuid
from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.db.models import AiMemoryCategory, AiMessageRole, AiSafetyLabel
from app.schemas.base import ApiModel

MAX_USER_MESSAGE_CHARS = 2_000
MAX_TEMPORARY_CONTEXT_MESSAGES = 20
MAX_TEMPORARY_CONTEXT_CHARS = 12_000
MAX_PROVIDER_REPLY_CHARS = 8_000


def _trim_content(value: str) -> str:
    value = value.strip()
    if not value:
        raise ValueError("content must not be blank")
    return value


class PaginationResponse(ApiModel):
    page: int = Field(ge=1)
    page_size: int = Field(ge=1, le=100)
    total_items: int = Field(ge=0)
    total_pages: int = Field(ge=0)


class ConversationResponse(ApiModel):
    id: uuid.UUID
    title: str = Field(min_length=1, max_length=80)
    last_message_at: datetime | None
    created_at: datetime


class ConversationListResponse(ApiModel):
    items: list[ConversationResponse]
    pagination: PaginationResponse


class AiMessageResponse(ApiModel):
    id: uuid.UUID
    role: AiMessageRole
    content: str = Field(min_length=1, max_length=MAX_PROVIDER_REPLY_CHARS)
    recipe_ids: list[uuid.UUID] = Field(default_factory=list)
    safety_label: AiSafetyLabel
    created_at: datetime


class MessageListResponse(ApiModel):
    items: list[AiMessageResponse]
    pagination: PaginationResponse


class SendMessageRequest(ApiModel):
    content: str = Field(max_length=MAX_USER_MESSAGE_CHARS)
    client_message_id: uuid.UUID

    @field_validator("content", mode="before")
    @classmethod
    def trim_content(cls, value: str) -> str:
        return _trim_content(value)


class TemporaryContextMessage(ApiModel):
    role: AiMessageRole
    content: str = Field(max_length=MAX_USER_MESSAGE_CHARS)

    @field_validator("content", mode="before")
    @classmethod
    def trim_content(cls, value: str) -> str:
        return _trim_content(value)


class TemporaryMessageRequest(SendMessageRequest):
    context: list[TemporaryContextMessage] = Field(max_length=MAX_TEMPORARY_CONTEXT_MESSAGES)

    @model_validator(mode="after")
    def enforce_context_character_budget(self) -> "TemporaryMessageRequest":
        character_count = sum(
            len(message.role.value) + len(message.content) for message in self.context
        )
        if character_count > MAX_TEMPORARY_CONTEXT_CHARS:
            raise ValueError("temporary context exceeds character budget")
        return self


class AiUsageResponse(ApiModel):
    limit: int = Field(ge=0)
    used: int = Field(ge=0)
    remaining: int = Field(ge=0)
    resets_at: datetime


class AiMemoryResponse(ApiModel):
    id: uuid.UUID
    category: AiMemoryCategory
    summary: str = Field(min_length=1, max_length=240)
    created_at: datetime


class MemoryListResponse(ApiModel):
    items: list[AiMemoryResponse]


class MemoryChangeAction(StrEnum):
    CREATED = "CREATED"
    UPDATED = "UPDATED"


class MemoryChange(ApiModel):
    id: uuid.UUID
    action: MemoryChangeAction
    category: AiMemoryCategory
    summary: str = Field(min_length=1, max_length=240)


class SendMessageResponse(ApiModel):
    conversation: ConversationResponse
    user_message: AiMessageResponse
    assistant_message: AiMessageResponse
    usage: AiUsageResponse
    memory_changes: list[MemoryChange] = Field(default_factory=list)


class TemporaryMessageResponse(ApiModel):
    assistant_message: AiMessageResponse
    usage: AiUsageResponse
    memory_changes: list[MemoryChange] = Field(default_factory=list)


class MemorySettingsRequest(ApiModel):
    enabled: bool


class MessageFeedback(StrEnum):
    HELPFUL = "HELPFUL"
    NOT_HELPFUL = "NOT_HELPFUL"


class MessageFeedbackRequest(ApiModel):
    feedback: MessageFeedback


class RegenerateMessageRequest(ApiModel):
    client_message_id: uuid.UUID


class AiGenerationMessage(ApiModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1)

    @model_validator(mode="after")
    def enforce_role_aware_content_limit(self) -> "AiGenerationMessage":
        limit = (
            MAX_USER_MESSAGE_CHARS
            if self.role == "user"
            else MAX_PROVIDER_REPLY_CHARS
        )
        if len(self.content) > limit:
            raise ValueError(f"{self.role} generation message exceeds character limit")
        return self


class AiRecipeCandidate(ApiModel):
    id: uuid.UUID
    name: str = Field(min_length=1, max_length=120)
    description: str = Field(max_length=2_000)
    tags: list[str] = Field(default_factory=list)


class AiMemoryCandidate(ApiModel):
    category: AiMemoryCategory
    memory_key: str = Field(min_length=1, max_length=80)
    summary: str = Field(min_length=1, max_length=240)
    confidence: float = Field(ge=0, le=1)
    sensitive: bool


class AiGenerationRequest(ApiModel):
    system_prompt: str = Field(min_length=1)
    messages: list[AiGenerationMessage]
    memories: list[str] = Field(default_factory=list, max_length=20)
    cellar_ingredient_ids: list[str] = Field(default_factory=list)
    candidate_recipes: list[AiRecipeCandidate] = Field(default_factory=list)
    max_output_chars: int = Field(default=MAX_PROVIDER_REPLY_CHARS, ge=1, le=MAX_PROVIDER_REPLY_CHARS)
    context_text: str = Field(min_length=1, exclude=True)


class AiGenerationResult(ApiModel):
    reply_text: str
    recipe_ids: list[uuid.UUID] = Field(default_factory=list)
    memory_candidates: list[AiMemoryCandidate] = Field(default_factory=list)
    provider: str = Field(min_length=1, max_length=80)
    model: str = Field(min_length=1, max_length=120)
    input_tokens: int | None = Field(default=None, ge=0)
    output_tokens: int | None = Field(default=None, ge=0)
    cost_estimate: float | None = Field(default=None, ge=0)
    safety_label: AiSafetyLabel = AiSafetyLabel.SAFE
