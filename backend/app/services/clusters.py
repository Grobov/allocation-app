"""Cluster CRUD."""

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.errors import ConflictError
from app.models import Cluster, Engineer, Project
from app.schemas import ClusterCreate, ClusterRead, ClusterUpdate
from app.services.common import (
    ensure_unique_name,
    get_live_or_404,
    get_live_reference,
    utcnow,
)


def _read(cluster: Cluster) -> ClusterRead:
    return ClusterRead.model_validate(cluster)


def list_clusters(session: Session) -> list[ClusterRead]:
    rows = session.scalars(
        select(Cluster)
        .options(joinedload(Cluster.qa_manager))
        .where(Cluster.deleted_at.is_(None))
        .order_by(Cluster.id)
    ).all()
    return [_read(c) for c in rows]


def get_cluster(session: Session, cluster_id: int) -> ClusterRead:
    return _read(get_live_or_404(session, Cluster, cluster_id))


def create_cluster(session: Session, data: ClusterCreate) -> ClusterRead:
    ensure_unique_name(session, Cluster, Cluster.name, data.name, field="name")
    if data.qa_manager_id is not None:
        get_live_reference(session, Engineer, data.qa_manager_id, "qa_manager_id")
    cluster = Cluster(name=data.name, qa_manager_id=data.qa_manager_id)
    session.add(cluster)
    session.commit()
    session.refresh(cluster)
    return _read(cluster)


def update_cluster(session: Session, cluster_id: int, data: ClusterUpdate) -> ClusterRead:
    cluster = get_live_or_404(session, Cluster, cluster_id)
    changes = data.changes()
    if "name" in changes:
        ensure_unique_name(
            session, Cluster, Cluster.name, changes["name"], field="name", exclude_id=cluster.id
        )
    if changes.get("qa_manager_id") is not None:
        get_live_reference(session, Engineer, changes["qa_manager_id"], "qa_manager_id")
    for field, value in changes.items():
        setattr(cluster, field, value)
    session.commit()
    session.refresh(cluster)
    return _read(cluster)


def delete_cluster(session: Session, cluster_id: int) -> None:
    """Soft-delete a cluster. Only empty clusters can be deleted."""
    cluster = get_live_or_404(session, Cluster, cluster_id)
    project_count = session.scalar(
        select(func.count(Project.id)).where(
            Project.cluster_id == cluster.id, Project.deleted_at.is_(None)
        )
    )
    if project_count:
        raise ConflictError(
            f"Cluster “{cluster.name}” still has {project_count} project(s). "
            "Move or delete them before deleting the cluster."
        )
    cluster.deleted_at = utcnow()
    session.commit()
