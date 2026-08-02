import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, Text, UniqueConstraint
from sqlmodel import Column, Field, SQLModel

from app.db.models.accounts import utc_now
from app.db.models.content import json_column


class CommunityFeedCategory(StrEnum):
    RECOMMENDED = "recommended"
    FOLLOWING = "following"
    NEARBY = "nearby"


class CommunityPostVisibility(StrEnum):
    PUBLIC = "public"
    PRIVATE = "private"


class CommunityPost(SQLModel, table=True):
    __tablename__ = "community_posts"

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    author_id: uuid.UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        index=True,
    )
    category: CommunityFeedCategory = Field(
        default=CommunityFeedCategory.RECOMMENDED,
        sa_column=Column(
            Enum(
                CommunityFeedCategory,
                name="community_feed_category",
                values_callable=lambda enum: [item.value for item in enum],
            ),
            nullable=False,
            index=True,
        ),
    )
    title: str = Field(max_length=80)
    body: str = Field(sa_column=Column(Text(), nullable=False))
    image_key: str = Field(default="barInterior", max_length=80)
    images: list[dict[str, object]] = Field(default_factory=list, sa_column=json_column())
    topics: list[str] = Field(default_factory=list, sa_column=json_column())
    venue_id: str | None = Field(default=None, max_length=120)
    visibility: CommunityPostVisibility = Field(
        default=CommunityPostVisibility.PUBLIC,
        sa_column=Column(
            Enum(
                CommunityPostVisibility,
                name="community_post_visibility",
                values_callable=lambda enum: [item.value for item in enum],
            ),
            nullable=False,
            index=True,
        ),
    )
    allow_comments: bool = True
    like_count: int = Field(default=0, ge=0)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )


class CommunityComment(SQLModel, table=True):
    __tablename__ = "community_comments"
    __table_args__ = (
        CheckConstraint("like_count >= 0", name="ck_community_comments_like_count"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    post_id: uuid.UUID = Field(
        foreign_key="community_posts.id",
        ondelete="CASCADE",
        index=True,
    )
    author_id: uuid.UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        index=True,
    )
    parent_comment_id: uuid.UUID | None = Field(
        default=None,
        foreign_key="community_comments.id",
        ondelete="CASCADE",
        index=True,
    )
    text: str = Field(sa_column=Column(Text(), nullable=False))
    like_count: int = Field(default=0, ge=0)
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )


class CommunityPostLike(SQLModel, table=True):
    __tablename__ = "community_post_likes"
    __table_args__ = (
        UniqueConstraint("post_id", "user_id", name="uq_community_post_likes_post_user"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    post_id: uuid.UUID = Field(
        foreign_key="community_posts.id",
        ondelete="CASCADE",
        index=True,
    )
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        index=True,
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )


class CommunityCommentLike(SQLModel, table=True):
    __tablename__ = "community_comment_likes"
    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_community_comment_likes_comment_user"),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    comment_id: uuid.UUID = Field(
        foreign_key="community_comments.id",
        ondelete="CASCADE",
        index=True,
    )
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        index=True,
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False, index=True),
    )
