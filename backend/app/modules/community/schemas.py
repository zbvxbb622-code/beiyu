from datetime import datetime
from typing import Literal

from pydantic import Field, field_validator, model_validator

from app.schemas.base import ApiModel

FeedCategory = Literal["recommended", "following", "nearby"]
PostVisibility = Literal["public", "private"]


class CommunityPostImage(ApiModel):
    id: str = Field(min_length=1, max_length=120)
    kind: Literal["asset", "uri"]
    asset_key: str | None = Field(default=None, min_length=1, max_length=80)
    uri: str | None = Field(default=None, min_length=1, max_length=2048)

    @model_validator(mode="after")
    def require_matching_image_value(self) -> "CommunityPostImage":
        if self.kind == "asset" and not self.asset_key:
            raise ValueError("asset images require assetKey")
        if self.kind == "uri" and not self.uri:
            raise ValueError("uri images require uri")
        return self


class CommunityCommentResponse(ApiModel):
    id: str
    author_id: str
    author_name: str
    author_avatar_key: str
    text: str
    date: str
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
