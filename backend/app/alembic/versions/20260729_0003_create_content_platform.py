"""create content platform

Revision ID: 20260729_0003
Revises: 20260729_0002
Create Date: 2026-07-29 16:00:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "20260729_0003"
down_revision: str | Sequence[str] | None = "20260729_0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    bind = op.get_bind()
    user_role = postgresql.ENUM(
        "USER",
        "EDITOR",
        "SUPER_ADMIN",
        name="user_role",
        create_type=False,
    )
    content_status = postgresql.ENUM(
        "DRAFT",
        "PUBLISHED",
        "ARCHIVED",
        name="content_status",
        create_type=False,
    )
    ingredient_category = postgresql.ENUM(
        "base",
        "liqueur",
        "citrus",
        "mixer",
        "sweetener",
        "garnish",
        "tool",
        name="ingredient_category",
        create_type=False,
    )
    content_type = postgresql.ENUM(
        "INGREDIENT",
        "RECIPE",
        "BAR",
        "KNOWLEDGE",
        "BANNER",
        "SHORTCUT",
        name="content_type",
        create_type=False,
    )
    content_action = postgresql.ENUM(
        "CREATE",
        "UPDATE",
        "PUBLISH",
        "ARCHIVE",
        "ROLLBACK",
        name="content_action",
        create_type=False,
    )
    for enum_type in (
        user_role,
        content_status,
        ingredient_category,
        content_type,
        content_action,
    ):
        enum_type.create(bind, checkfirst=True)

    op.add_column(
        "users",
        sa.Column(
            "role",
            user_role,
            server_default=sa.text("'USER'"),
            nullable=False,
        ),
    )
    op.create_index(op.f("ix_users_role"), "users", ["role"], unique=False)

    op.create_table(
        "ingredients",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("public_id", sa.String(length=120), nullable=False),
        sa.Column("status", content_status, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(length=80), nullable=False),
        sa.Column("category", ingredient_category, nullable=False),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column("image_key", sa.String(length=80), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.CheckConstraint("revision >= 1", name="ck_ingredients_revision"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_ingredients_public_id"),
    )
    op.create_index(
        op.f("ix_ingredients_category"),
        "ingredients",
        ["category"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ingredients_public_id"),
        "ingredients",
        ["public_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_ingredients_status"),
        "ingredients",
        ["status"],
        unique=False,
    )

    op.create_table(
        "recipes",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("public_id", sa.String(length=120), nullable=False),
        sa.Column("status", content_status, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("english_name", sa.String(length=160), nullable=False),
        sa.Column("description", sa.String(length=2000), nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("steps", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("image_key", sa.String(length=80), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("difficulty", sa.String(length=20), nullable=False),
        sa.Column("prep_minutes", sa.Integer(), nullable=False),
        sa.CheckConstraint("prep_minutes >= 0", name="ck_recipes_prep_minutes"),
        sa.CheckConstraint("revision >= 1", name="ck_recipes_revision"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_recipes_public_id"),
    )
    op.create_index(
        op.f("ix_recipes_public_id"),
        "recipes",
        ["public_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_recipes_status"),
        "recipes",
        ["status"],
        unique=False,
    )

    op.create_table(
        "bars",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("public_id", sa.String(length=120), nullable=False),
        sa.Column("status", content_status, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.String(length=4000), nullable=False),
        sa.Column("image_key", sa.String(length=80), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("rating", sa.Float(), nullable=False),
        sa.Column("review_count", sa.Integer(), nullable=False),
        sa.Column("average_spend", sa.Integer(), nullable=False),
        sa.Column("distance_label", sa.String(length=80), nullable=False),
        sa.Column("metro_hint", sa.String(length=160), nullable=False),
        sa.Column("address", sa.String(length=240), nullable=False),
        sa.Column("open_hours", sa.String(length=160), nullable=False),
        sa.Column("tags", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("taste_score", sa.Float(), nullable=False),
        sa.Column("environment_score", sa.Float(), nullable=False),
        sa.Column("service_score", sa.Float(), nullable=False),
        sa.Column("phone", sa.String(length=40), nullable=False),
        sa.Column("latitude", sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column("longitude", sa.Numeric(precision=10, scale=7), nullable=True),
        sa.Column("menu", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column(
            "featured_reviews",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.CheckConstraint("average_spend >= 0", name="ck_bars_average_spend"),
        sa.CheckConstraint("rating >= 0 AND rating <= 5", name="ck_bars_rating"),
        sa.CheckConstraint("review_count >= 0", name="ck_bars_review_count"),
        sa.CheckConstraint("revision >= 1", name="ck_bars_revision"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_bars_public_id"),
    )
    op.create_index(op.f("ix_bars_public_id"), "bars", ["public_id"], unique=False)
    op.create_index(op.f("ix_bars_status"), "bars", ["status"], unique=False)

    op.create_table(
        "home_banners",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("public_id", sa.String(length=120), nullable=False),
        sa.Column("status", content_status, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("brand", sa.String(length=80), nullable=False),
        sa.Column("title", sa.String(length=160), nullable=False),
        sa.Column("subtitle", sa.String(length=160), nullable=False),
        sa.Column("script_label", sa.String(length=80), nullable=False),
        sa.Column("cta_label", sa.String(length=80), nullable=False),
        sa.Column("target_route", sa.String(length=240), nullable=False),
        sa.Column("image_key", sa.String(length=80), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("revision >= 1", name="ck_home_banners_revision"),
        sa.CheckConstraint("sort_order >= 0", name="ck_home_banners_sort_order"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_home_banners_public_id"),
    )
    op.create_index(
        op.f("ix_home_banners_public_id"),
        "home_banners",
        ["public_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_home_banners_status"),
        "home_banners",
        ["status"],
        unique=False,
    )

    op.create_table(
        "home_shortcuts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("public_id", sa.String(length=120), nullable=False),
        sa.Column("status", content_status, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("title", sa.String(length=80), nullable=False),
        sa.Column("description", sa.String(length=240), nullable=False),
        sa.Column("icon", sa.String(length=40), nullable=False),
        sa.Column("route", sa.String(length=240), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.CheckConstraint("revision >= 1", name="ck_home_shortcuts_revision"),
        sa.CheckConstraint("sort_order >= 0", name="ck_home_shortcuts_sort_order"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_id", name="uq_home_shortcuts_public_id"),
    )
    op.create_index(
        op.f("ix_home_shortcuts_public_id"),
        "home_shortcuts",
        ["public_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_home_shortcuts_status"),
        "home_shortcuts",
        ["status"],
        unique=False,
    )

    op.create_table(
        "recipe_ingredients",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("recipe_id", sa.Uuid(), nullable=False),
        sa.Column("ingredient_id", sa.Uuid(), nullable=False),
        sa.Column("amount", sa.String(length=80), nullable=False),
        sa.Column("sort_order", sa.Integer(), nullable=False),
        sa.CheckConstraint(
            "sort_order >= 0",
            name="ck_recipe_ingredients_sort_order",
        ),
        sa.ForeignKeyConstraint(["ingredient_id"], ["ingredients.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "recipe_id",
            "ingredient_id",
            name="uq_recipe_ingredients_pair",
        ),
    )
    op.create_index(
        op.f("ix_recipe_ingredients_ingredient_id"),
        "recipe_ingredients",
        ["ingredient_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_recipe_ingredients_recipe_id"),
        "recipe_ingredients",
        ["recipe_id"],
        unique=False,
    )

    op.create_table(
        "drink_knowledge_entries",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("public_id", sa.String(length=120), nullable=False),
        sa.Column("status", content_status, nullable=False),
        sa.Column("revision", sa.Integer(), nullable=False),
        sa.Column("published_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("recipe_id", sa.Uuid(), nullable=True),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("english_name", sa.String(length=160), nullable=False),
        sa.Column("image_key", sa.String(length=80), nullable=True),
        sa.Column("image_url", sa.String(length=2048), nullable=True),
        sa.Column("era", sa.String(length=240), nullable=False),
        sa.Column("meaning", sa.String(length=500), nullable=False),
        sa.Column("story", sa.String(length=6000), nullable=False),
        sa.Column("symbols", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.CheckConstraint(
            "revision >= 1",
            name="ck_drink_knowledge_entries_revision",
        ),
        sa.ForeignKeyConstraint(["recipe_id"], ["recipes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "public_id",
            name="uq_drink_knowledge_entries_public_id",
        ),
    )
    op.create_index(
        op.f("ix_drink_knowledge_entries_public_id"),
        "drink_knowledge_entries",
        ["public_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_drink_knowledge_entries_recipe_id"),
        "drink_knowledge_entries",
        ["recipe_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_drink_knowledge_entries_status"),
        "drink_knowledge_entries",
        ["status"],
        unique=False,
    )

    op.create_table(
        "content_versions",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("content_type", content_type, nullable=False),
        sa.Column("content_id", sa.Uuid(), nullable=False),
        sa.Column("version_no", sa.Integer(), nullable=False),
        sa.Column("snapshot", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("action", content_action, nullable=False),
        sa.Column("created_by_admin_id", sa.Uuid(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.CheckConstraint("version_no >= 1", name="ck_content_versions_number"),
        sa.ForeignKeyConstraint(
            ["created_by_admin_id"],
            ["users.id"],
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "content_type",
            "content_id",
            "version_no",
            name="uq_content_versions_number",
        ),
    )
    op.create_index(
        op.f("ix_content_versions_content_id"),
        "content_versions",
        ["content_id"],
        unique=False,
    )
    op.create_index(
        op.f("ix_content_versions_content_type"),
        "content_versions",
        ["content_type"],
        unique=False,
    )
    op.create_index(
        op.f("ix_content_versions_created_at"),
        "content_versions",
        ["created_at"],
        unique=False,
    )
    op.create_index(
        op.f("ix_content_versions_created_by_admin_id"),
        "content_versions",
        ["created_by_admin_id"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_table("content_versions")
    op.drop_table("drink_knowledge_entries")
    op.drop_table("recipe_ingredients")
    op.drop_table("home_shortcuts")
    op.drop_table("home_banners")
    op.drop_table("bars")
    op.drop_table("recipes")
    op.drop_table("ingredients")
    op.drop_index(op.f("ix_users_role"), table_name="users")
    op.drop_column("users", "role")

    bind = op.get_bind()
    for enum_name in (
        "content_action",
        "content_type",
        "ingredient_category",
        "content_status",
        "user_role",
    ):
        postgresql.ENUM(name=enum_name).drop(bind, checkfirst=True)
