"""Aggregated read model for the Allocation Dashboard (loaded with a handful of queries)."""

from collections import defaultdict
from datetime import date

from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from app.models import Allocation, Cluster, Engineer, Project
from app.schemas import (
    Dashboard,
    DashboardAllocation,
    DashboardCluster,
    DashboardProject,
    DashboardSummary,
    EngineerRef,
)
from app.services.allocations import allocation_status, current_clause


def build_dashboard(session: Session, today: date) -> Dashboard:
    clusters = session.scalars(
        select(Cluster)
        .options(joinedload(Cluster.qa_manager))
        .where(Cluster.deleted_at.is_(None))
        .order_by(Cluster.id)
    ).all()
    projects = session.scalars(
        select(Project).where(Project.deleted_at.is_(None)).order_by(Project.id)
    ).all()
    allocations = session.scalars(
        select(Allocation)
        .options(joinedload(Allocation.engineer))
        .where(current_clause(today))
        .order_by(Allocation.id)
    ).all()

    allocations_by_project: dict[int, list[DashboardAllocation]] = defaultdict(list)
    for a in allocations:
        allocations_by_project[a.project_id].append(
            DashboardAllocation(
                id=a.id,
                engineer=EngineerRef.model_validate(a.engineer),
                role=a.role,
                percent=a.percent,
                comment=a.comment,
                start_date=a.start_date,
                end_date=a.end_date,
                status=allocation_status(a, today),
            )
        )

    projects_by_cluster: dict[int, list[DashboardProject]] = defaultdict(list)
    for p in projects:
        projects_by_cluster[p.cluster_id].append(
            DashboardProject(
                id=p.id,
                name=p.name,
                description=p.description,
                cluster_id=p.cluster_id,
                allocations=allocations_by_project.get(p.id, []),
            )
        )

    engineer_count = (
        session.scalar(select(func.count(Engineer.id)).where(Engineer.deleted_at.is_(None))) or 0
    )
    busy_ids = {a.engineer_id for a in allocations}
    busy_ids |= {c.qa_manager_id for c in clusters if c.qa_manager_id is not None}
    busy_count = (
        session.scalar(
            select(func.count(Engineer.id)).where(
                Engineer.deleted_at.is_(None), Engineer.id.in_(busy_ids)
            )
        )
        or 0
    )

    return Dashboard(
        today=today,
        summary=DashboardSummary(
            clusters=len(clusters),
            projects=len(projects),
            engineers=engineer_count,
            unallocated_engineers=engineer_count - busy_count,
        ),
        clusters=[
            DashboardCluster(
                id=c.id,
                name=c.name,
                qa_manager=EngineerRef.model_validate(c.qa_manager) if c.qa_manager else None,
                projects=projects_by_cluster.get(c.id, []),
            )
            for c in clusters
        ],
    )
