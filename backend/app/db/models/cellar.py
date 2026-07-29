import uuid
from datetime import datetime
from enum import StrEnum

from sqlalchemy import CheckConstraint, DateTime, Enum, Index, text
from sqlmodel import Column, Field, SQLModel

from app.db.models.accounts import utc_now


class CellarItemSource(StrEnum):
    MANUAL = "MANUAL"
    LOCAL_SYNC = "LOCAL_SYNC"


class CellarItem(SQLModel, table=True):
    __tablename__ = "cellar_items"
    __table_args__ = (
        CheckConstraint(
            "(ingredient_key IS NOT NULL AND custom_name IS NULL "
            "AND normalized_custom_name IS NULL) OR "
            "(ingredient_key IS NULL AND custom_name IS NOT NULL "
            "AND normalized_custom_name IS NOT NULL)",
            name="ck_cellar_items_identity",
        ),
        Index(
            "uq_cellar_items_active_ingredient",
            "user_id",
            "ingredient_key",
            unique=True,
            postgresql_where=text("deleted_at IS NULL AND ingredient_key IS NOT NULL"),
        ),
        Index(
            "uq_cellar_items_active_custom_name",
            "user_id",
            "normalized_custom_name",
            unique=True,
            postgresql_where=text(
                "deleted_at IS NULL AND normalized_custom_name IS NOT NULL"
            ),
        ),
    )

    id: uuid.UUID = Field(default_factory=uuid.uuid4, primary_key=True)
    user_id: uuid.UUID = Field(
        foreign_key="users.id",
        ondelete="CASCADE",
        index=True,
    )
    ingredient_key: str | None = Field(default=None, max_length=80)
    custom_name: str | None = Field(default=None, max_length=80)
    normalized_custom_name: str | None = Field(default=None, max_length=80)
    amount_label: str | None = Field(default=None, max_length=40)
    note: str | None = Field(default=None, max_length=200)
    source: CellarItemSource = Field(
        default=CellarItemSource.MANUAL,
        sa_column=Column(
            Enum(CellarItemSource, name="cellar_item_source"),
            nullable=False,
        ),
    )
    deleted_at: datetime | None = Field(
        default=None,
        sa_column=Column(DateTime(timezone=True), nullable=True),
    )
    created_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
    updated_at: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
