from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ApiModel

FeedCategory = Literal["recommended", "following", "nearby"]
PostVisibility = Literal["public", "private"]
ModerationStatus = Literal["approved", "hidden", "rejected"]
ReportTargetType = Literal["post", "comment"]
ReportStatus = Literal["open", "resolved"]


class CommunityPostImage(ApiModel):
    id: str = Field(min_length=1, max_length=120)
    kind: Literal["asset", "uri", "remote"]
    asset_key: str | None = Field(default=None, min_length=1, max_length=80)
    uri: str | None = Field(default=None, min_length=1, max_length=2048)
    media_id: str | None = Field(default=None, min_length=1, max_length=120)
    url: str | None = Field(default=None, min_length=1, max_length=2048)

    @model_validator(mode="after")
    def require_matching_image_value(self) -> "CommunityPostImage":
        if self.kind == "asset" and not self.asset_key:
            raise ValueError("asset images require assetKey")
        if self.kind == "uri" and not self.uri:
            raise ValueError("uri images require uri")
        if self.kind == "remote" and (not self.media_id or not self.url):
            raise ValueError("remote images require mediaId and url")
        return self


class CommunityCommentResponse(ApiModel):
    id: str
    author_id: str
    author_name: str
    author_avatar_key: str
    parent_comment_id: str | None = None
    text: str
    date: str
    likes: int = Field(ge=0)
    liked_by_me: bool = False
    moderation_status: ModerationStatus = "approved"
    created_at: datetime


class CommunityPostResponse(ApiModel):
    id: str
    category: FeedCategory
    title: str
    author_id: str
    author_name: str
    author_avatar_key: str
    image_key: str
    body: str
    date: str
    likes: int = Field(ge=0)
    liked_by_me: bool = False
    comments: list[CommunityCommentResponse]
    venue_id: str | None = None
    images: list[CommunityPostImage] = Field(default_factory=list)
    topics: list[str] = Field(default_factory=list)
    visibility: PostVisibility = "public"
    allow_comments: bool = True
    moderation_status: ModerationStatus = "approved"
    created_at: datetime


class CommunityPostListResponse(ApiModel):
    items: list[CommunityPostResponse]


class CommunityPostCreate(ApiModel):
    title: str = Field(min_length=1, max_length=80)
    body: str = Field(min_length=1, max_length=4000)
    category: FeedCategory = "recommended"
    image_key: str | None = Field(default=None, max_length=80)
    images: list[CommunityPostImage] = Field(default_factory=list, max_length=9)
    topics: list[str] = Field(default_factory=list, max_length=20)
    venue_id: str | None = Field(default=None, max_length=120)
    visibility: PostVisibility = "public"
    allow_comments: bool = True

    @field_validator("title", "body")
    @classmethod
    def strip_required_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("text cannot be blank")
        return stripped

    @field_validator("topics")
    @classmethod
    def normalize_topics(cls, topics: list[str]) -> list[str]:
        normalized: list[str] = []
        seen: set[str] = set()
        for topic in topics:
            value = topic.strip().lstrip("#")
            if not value or value in seen:
                continue
            if len(value) > 40:
                raise ValueError("topic is too long")
            seen.add(value)
            normalized.append(value)
        return normalized


class CommunityCommentCreate(ApiModel):
    text: str = Field(min_length=1, max_length=1000)
    parent_comment_id: UUID | None = None

    @field_validator("text")
    @classmethod
    def strip_text(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("comment cannot be blank")
        return stripped


class CommunityReportCreate(ApiModel):
    reason: str = Field(min_length=1, max_length=40)
    detail: str = Field(default="", max_length=1000)

    @field_validator("reason")
    @classmethod
    def strip_reason(cls, value: str) -> str:
        stripped = value.strip()
        if not stripped:
            raise ValueError("reason cannot be blank")
        return stripped

    @field_validator("detail")
    @classmethod
    def strip_detail(cls, value: str) -> str:
        return value.strip()


class CommunityReportResponse(ApiModel):
    id: str
    reporter_id: str
    target_type: ReportTargetType
    post_id: str | None = None
    comment_id: str | None = None
    reason: str
    detail: str
    status: ReportStatus
    created_at: datetime


class CommunityReportListResponse(ApiModel):
    items: list[CommunityReportResponse]


class CommunityModerationRequest(ApiModel):
    status: ModerationStatus
    note: str = Field(default="", max_length=500)

    @field_validator("note")
    @classmethod
    def strip_note(cls, value: str) -> str:
        return value.strip()


class CommunityAuditLogResponse(ApiModel):
    id: str
    actor_id: str
    target_type: ReportTargetType
    post_id: str | None = None
    comment_id: str | None = None
    action: str
    note: str
    created_at: datetime


class CommunityAuditLogListResponse(ApiModel):
    items: list[CommunityAuditLogResponse]
