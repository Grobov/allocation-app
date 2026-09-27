"""Initial schema: engineers, clusters, projects, allocations.

Revision ID: 0001
Revises:
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0001"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def _timestamps() -> list[sa.Column[object]]:
    return [
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("CURRENT_TIMESTAMP"),
            nullable=False,
        ),
    ]


def _unique_active_name(table: str, column: str) -> None:
    """Case-insensitive unique name among rows that are not soft-deleted."""
    op.create_index(
        f"uq_{table}_{column}_active",
        table,
        [sa.text(f"lower({column})")],
        unique=True,
        sqlite_where=sa.text("deleted_at IS NULL"),
        postgresql_where=sa.text("deleted_at IS NULL"),
    )


def upgrade() -> None:
    op.create_table(
        "engineers",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("full_name", sa.String(length=120), nullable=False),
        sa.Column("comment", sa.Text(), server_default="", nullable=False),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(full_name) > 0", name=op.f("ck_engineers_full_name_not_empty")),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_engineers")),
    )
    _unique_active_name("engineers", "full_name")

    op.create_table(
        "clusters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("qa_manager_id", sa.Integer(), nullable=True),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(name) > 0", name=op.f("ck_clusters_name_not_empty")),
        sa.ForeignKeyConstraint(
            ["qa_manager_id"],
            ["engineers.id"],
            name=op.f("fk_clusters_qa_manager_id_engineers"),
            ondelete="SET NULL",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_clusters")),
    )
    op.create_index(op.f("ix_clusters_qa_manager_id"), "clusters", ["qa_manager_id"])
    _unique_active_name("clusters", "name")

    op.create_table(
        "projects",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(length=120), nullable=False),
        sa.Column("description", sa.Text(), server_default="", nullable=False),
        sa.Column("cluster_id", sa.Integer(), nullable=False),
        *_timestamps(),
        sa.Column("deleted_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("length(name) > 0", name=op.f("ck_projects_name_not_empty")),
        sa.ForeignKeyConstraint(
            ["cluster_id"],
            ["clusters.id"],
            name=op.f("fk_projects_cluster_id_clusters"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_projects")),
    )
    op.create_index(op.f("ix_projects_cluster_id"), "projects", ["cluster_id"])
    _unique_active_name("projects", "name")

    op.create_table(
        "allocations",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("engineer_id", sa.Integer(), nullable=False),
        sa.Column("project_id", sa.Integer(), nullable=False),
        sa.Column("role", sa.String(length=20), nullable=False),
        sa.Column("percent", sa.SmallInteger(), nullable=False),
        sa.Column("comment", sa.Text(), server_default="", nullable=False),
        sa.Column("start_date", sa.Date(), nullable=False),
        sa.Column("end_date", sa.Date(), nullable=True),
        sa.Column("ended_at", sa.DateTime(timezone=True), nullable=True),
        *_timestamps(),
        sa.CheckConstraint("role IN ('QC', 'QC Lead')", name=op.f("ck_allocations_role_valid")),
        sa.CheckConstraint("percent BETWEEN 1 AND 100", name=op.f("ck_allocations_percent_range")),
        sa.CheckConstraint(
            "end_date IS NULL OR end_date >= start_date",
            name=op.f("ck_allocations_valid_period"),
        ),
        sa.ForeignKeyConstraint(
            ["engineer_id"],
            ["engineers.id"],
            name=op.f("fk_allocations_engineer_id_engineers"),
            ondelete="RESTRICT",
        ),
        sa.ForeignKeyConstraint(
            ["project_id"],
            ["projects.id"],
            name=op.f("fk_allocations_project_id_projects"),
            ondelete="RESTRICT",
        ),
        sa.PrimaryKeyConstraint("id", name=op.f("pk_allocations")),
    )
    op.create_index("ix_allocations_engineer_open", "allocations", ["engineer_id", "ended_at"])
    op.create_index("ix_allocations_project_open", "allocations", ["project_id", "ended_at"])


def downgrade() -> None:
    op.drop_table("allocations")
    op.drop_table("projects")
    op.drop_table("clusters")
    op.drop_table("engineers")
