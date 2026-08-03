"""harden community reports

Revision ID: 20260802_0009
Revises: 20260802_0008
Create Date: 2026-08-02 20:15:00

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20260802_0009"
down_revision: str | Sequence[str] | None = "20260802_0008"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_check_constraint(
        "ck_community_reports_target_reference",
        "community_reports",
        "((target_type = 'post' AND post_id IS NOT NULL AND comment_id IS NULL) "
        "OR (target_type = 'comment' AND post_id IS NOT NULL AND comment_id IS NOT NULL))",
    )
    op.create_check_constraint(
        "ck_community_audit_logs_target_reference",
        "community_audit_logs",
        "((target_type = 'post' AND post_id IS NOT NULL AND comment_id IS NULL) "
        "OR (target_type = 'comment' AND post_id IS NOT NULL AND comment_id IS NOT NULL))",
    )
    op.create_index(
        "uq_community_reports_open_post_reporter",
        "community_reports",
        ["reporter_id", "post_id"],
        unique=True,
        postgresql_where=sa.text("target_type = 'post' AND status = 'open'"),
    )
    op.create_index(
        "uq_community_reports_open_comment_reporter",
        "community_reports",
        ["reporter_id", "comment_id"],
        unique=True,
        postgresql_where=sa.text("target_type = 'comment' AND status = 'open'"),
    )


def downgrade() -> None:
    op.drop_index(
        "uq_community_reports_open_comment_reporter",
        table_name="community_reports",
        postgresql_where=sa.text("target_type = 'comment' AND status = 'open'"),
    )
    op.drop_index(
        "uq_community_reports_open_post_reporter",
        table_name="community_reports",
        postgresql_where=sa.text("target_type = 'post' AND status = 'open'"),
    )
    op.drop_constraint(
        "ck_community_audit_logs_target_reference",
        "community_audit_logs",
        type_="check",
    )
    op.drop_constraint(
        "ck_community_reports_target_reference",
        "community_reports",
        type_="check",
    )
