"""SQLAlchemy ORM models.

Domain overview
---------------
* ``Engineer``   - a person. Exists independently of projects.
* ``Cluster``    - a group of projects, optionally managed by a QA Manager (an Engineer).
* ``Project``    - belongs to exactly one Cluster; can be moved between clusters.
* ``Allocation`` - assignment of an Engineer to a Project for a period of time, with a
                   role, a percentage and a project-specific comment. Allocations are
                   never physically deleted: ending one keeps it as history.

Engineers, clusters and projects are *soft-deleted* (``deleted_at``) so that allocation
history keeps pointing at valid rows. Name uniqueness is enforced with partial unique
indexes that only cover non-deleted rows, so a name can be reused after deletion.
"""

import enum
from datetime import date, datetime
from typing import Any

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    MetaData,
    SmallInteger,
    String,
    Text,
    func,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

NAME_MAX_LENGTH = 120
COMMENT_MAX_LENGTH = 2000

NAMING_CONVENTION = {
    "ix": "ix_%(column_0_label)s",
    "uq": "uq_%(table_name)s_%(column_0_name)s",
    "ck": "ck_%(table_name)s_%(constraint_name)s",
    "fk": "fk_%(table_name)s_%(column_0_name)s_%(referred_table_name)s",
    "pk": "pk_%(table_name)s",
}


class Base(DeclarativeBase):
    metadata = MetaData(naming_convention=NAMING_CONVENTION)


class TimestampMixin:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class SoftDeleteMixin:
    deleted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def is_deleted(self) -> bool:
        return self.deleted_at is not None


class AllocationRole(enum.StrEnum):
    QC = "QC"
    QC_LEAD = "QC Lead"


class Engineer(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "engineers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH), nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")

    allocations: Mapped[list["Allocation"]] = relationship(back_populates="engineer")
    managed_clusters: Mapped[list["Cluster"]] = relationship(back_populates="qa_manager")

    __table_args__ = (CheckConstraint("length(full_name) > 0", name="full_name_not_empty"),)


class Cluster(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "clusters"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH), nullable=False)
    qa_manager_id: Mapped[int | None] = mapped_column(
        ForeignKey("engineers.id", ondelete="SET NULL"), nullable=True, index=True
    )

    qa_manager: Mapped[Engineer | None] = relationship(back_populates="managed_clusters")
    projects: Mapped[list["Project"]] = relationship(back_populates="cluster")

    __table_args__ = (CheckConstraint("length(name) > 0", name="name_not_empty"),)


class Project(TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "projects"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(NAME_MAX_LENGTH), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    cluster_id: Mapped[int] = mapped_column(
        ForeignKey("clusters.id", ondelete="RESTRICT"), nullable=False, index=True
    )

    cluster: Mapped[Cluster] = relationship(back_populates="projects")
    allocations: Mapped[list["Allocation"]] = relationship(back_populates="project")

    __table_args__ = (CheckConstraint("length(name) > 0", name="name_not_empty"),)


class Allocation(TimestampMixin, Base):
    __tablename__ = "allocations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    # FK lookups are covered by the composite (…_id, ended_at) indexes below.
    engineer_id: Mapped[int] = mapped_column(
        ForeignKey("engineers.id", ondelete="RESTRICT"), nullable=False
    )
    project_id: Mapped[int] = mapped_column(
        ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False
    )
    role: Mapped[AllocationRole] = mapped_column(
        Enum(
            AllocationRole,
            name="role_valid",
            native_enum=False,
            create_constraint=True,
            length=20,
            values_callable=lambda roles: [role.value for role in roles],
            validate_strings=True,
        ),
        nullable=False,
    )
    percent: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    comment: Mapped[str] = mapped_column(Text, nullable=False, default="", server_default="")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Last day (inclusive) the allocation is effective. NULL = open-ended.
    end_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    # Set when the allocation was explicitly ended via the "End allocation" action.
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    engineer: Mapped[Engineer] = relationship(back_populates="allocations")
    project: Mapped[Project] = relationship(back_populates="allocations")

    __table_args__ = (
        CheckConstraint("percent BETWEEN 1 AND 100", name="percent_range"),
        CheckConstraint("end_date IS NULL OR end_date >= start_date", name="valid_period"),
        Index("ix_allocations_project_open", "project_id", "ended_at"),
        Index("ix_allocations_engineer_open", "engineer_id", "ended_at"),
    )


def _unique_active_name(model: type[Engineer | Cluster | Project], column: Any) -> Index:
    """Case-insensitive unique name among non-deleted rows (partial functional index)."""
    return Index(
        f"uq_{model.__tablename__}_{column.key}_active",
        func.lower(column),
        unique=True,
        sqlite_where=model.deleted_at.is_(None),
        postgresql_where=model.deleted_at.is_(None),
    )


_unique_active_name(Engineer, Engineer.full_name)
_unique_active_name(Cluster, Cluster.name)
_unique_active_name(Project, Project.name)
