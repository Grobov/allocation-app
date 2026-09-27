"""Project CRUD."""

from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.errors import ConflictError
from app.models import Cluster, Project
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate
from app.services.allocations import count_current
from app.services.common import (
    ensure_unique_name,
    get_live_or_404,
    get_live_reference,
    utcnow,
)


def list_projects(session: Session, *, cluster_id: int | None = None) -> list[ProjectRead]:
    query = (
        select(Project)
        .options(joinedload(Project.cluster))
        .where(Project.deleted_at.is_(None))
        .order_by(Project.id)
    )
    if cluster_id is not None:
        query = query.where(Project.cluster_id == cluster_id)
    return [ProjectRead.model_validate(p) for p in session.scalars(query).all()]


def get_project(session: Session, project_id: int) -> ProjectRead:
    return ProjectRead.model_validate(get_live_or_404(session, Project, project_id))


def create_project(session: Session, data: ProjectCreate) -> ProjectRead:
    cluster = get_live_reference(session, Cluster, data.cluster_id, "cluster_id")
    ensure_unique_name(session, Project, Project.name, data.name, field="name")
    project = Project(name=data.name, description=data.description, cluster=cluster)
    session.add(project)
    session.commit()
    session.refresh(project)
    return ProjectRead.model_validate(project)


def update_project(session: Session, project_id: int, data: ProjectUpdate) -> ProjectRead:
    """Update a project; changing ``cluster_id`` moves it (with its allocations)."""
    project = get_live_or_404(session, Project, project_id)
    changes = data.changes()
    if "name" in changes:
        ensure_unique_name(
            session, Project, Project.name, changes["name"], field="name", exclude_id=project.id
        )
    if "cluster_id" in changes:
        get_live_reference(session, Cluster, changes["cluster_id"], "cluster_id")
    for field, value in changes.items():
        setattr(project, field, value)
    session.commit()
    session.refresh(project)
    return ProjectRead.model_validate(project)


def delete_project(session: Session, project_id: int, today: date) -> None:
    """Soft-delete a project. Blocked while it has current allocations."""
    project = get_live_or_404(session, Project, project_id)
    current = count_current(session, today, project_id=project.id)
    if current:
        raise ConflictError(
            f"Project “{project.name}” has {current} current allocation(s). "
            "End them before deleting the project."
        )
    project.deleted_at = utcnow()
    session.commit()
