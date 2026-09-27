"""Engineer CRUD and the Engineers overview."""

from collections import defaultdict
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.errors import ConflictError
from app.models import Allocation, Cluster, Engineer
from app.schemas import (
    AllocationStatus,
    ClusterRef,
    EngineerCreate,
    EngineerOverview,
    EngineerOverviewAllocation,
    EngineerRead,
    EngineerStatus,
    EngineerUpdate,
    ProjectRef,
)
from app.services.allocations import (
    Period,
    allocation_status,
    count_current,
    current_clause,
    peak_load,
)
from app.services.common import ensure_unique_name, get_live_or_404, utcnow


def list_engineers(session: Session) -> list[EngineerRead]:
    rows = session.scalars(
        select(Engineer).where(Engineer.deleted_at.is_(None)).order_by(Engineer.id)
    ).all()
    return [EngineerRead.model_validate(e) for e in rows]


def get_engineer(session: Session, engineer_id: int) -> EngineerRead:
    return EngineerRead.model_validate(get_live_or_404(session, Engineer, engineer_id))


def create_engineer(session: Session, data: EngineerCreate) -> EngineerRead:
    ensure_unique_name(session, Engineer, Engineer.full_name, data.full_name, field="full_name")
    engineer = Engineer(full_name=data.full_name, comment=data.comment)
    session.add(engineer)
    session.commit()
    return EngineerRead.model_validate(engineer)


def update_engineer(session: Session, engineer_id: int, data: EngineerUpdate) -> EngineerRead:
    engineer = get_live_or_404(session, Engineer, engineer_id)
    changes = data.changes()
    if "full_name" in changes:
        ensure_unique_name(
            session,
            Engineer,
            Engineer.full_name,
            changes["full_name"],
            field="full_name",
            exclude_id=engineer.id,
        )
    for field, value in changes.items():
        setattr(engineer, field, value)
    session.commit()
    session.refresh(engineer)
    return EngineerRead.model_validate(engineer)


def delete_engineer(session: Session, engineer_id: int, today: date) -> None:
    """Soft-delete an engineer.

    Blocked while the engineer has current allocations; clusters they manage become
    unassigned. Ended allocations are kept as history.
    """
    engineer = get_live_or_404(session, Engineer, engineer_id)
    current = count_current(session, today, engineer_id=engineer.id)
    if current:
        raise ConflictError(
            f"{engineer.full_name} has {current} current allocation(s). "
            "End them before deleting the engineer."
        )
    for cluster in session.scalars(
        select(Cluster).where(Cluster.qa_manager_id == engineer.id, Cluster.deleted_at.is_(None))
    ):
        cluster.qa_manager_id = None
    engineer.deleted_at = utcnow()
    session.commit()


def engineers_overview(session: Session, today: date) -> list[EngineerOverview]:
    engineers = session.scalars(
        select(Engineer).where(Engineer.deleted_at.is_(None)).order_by(Engineer.id)
    ).all()

    allocations_by_engineer: dict[int, list[Allocation]] = defaultdict(list)
    for allocation in session.scalars(
        select(Allocation)
        .options(joinedload(Allocation.project))
        .where(current_clause(today))
        .order_by(Allocation.start_date, Allocation.id)
    ):
        allocations_by_engineer[allocation.engineer_id].append(allocation)

    clusters_by_manager: dict[int, list[Cluster]] = defaultdict(list)
    for cluster in session.scalars(
        select(Cluster)
        .where(Cluster.deleted_at.is_(None), Cluster.qa_manager_id.is_not(None))
        .order_by(Cluster.id)
    ):
        assert cluster.qa_manager_id is not None
        clusters_by_manager[cluster.qa_manager_id].append(cluster)

    result = []
    for engineer in engineers:
        allocations = allocations_by_engineer.get(engineer.id, [])
        managed = clusters_by_manager.get(engineer.id, [])
        items = [
            EngineerOverviewAllocation(
                id=a.id,
                project=ProjectRef.model_validate(a.project),
                role=a.role,
                percent=a.percent,
                start_date=a.start_date,
                end_date=a.end_date,
                status=allocation_status(a, today),
            )
            for a in allocations
        ]
        total, _ = peak_load(
            (Period(a.start_date, a.end_date, a.percent) for a in allocations),
            Period(today, None, 0),
        )
        result.append(
            EngineerOverview(
                id=engineer.id,
                full_name=engineer.full_name,
                comment=engineer.comment,
                allocations=items,
                managed_clusters=[ClusterRef.model_validate(c) for c in managed],
                total_percent=total,
                status=_engineer_status(items, bool(managed)),
            )
        )
    return result


def _engineer_status(
    allocations: list[EngineerOverviewAllocation], is_manager: bool
) -> EngineerStatus:
    statuses = {a.status for a in allocations}
    if AllocationStatus.ACTIVE in statuses:
        return EngineerStatus.ALLOCATED
    if AllocationStatus.PLANNED in statuses:
        return EngineerStatus.PLANNED
    if is_manager:
        return EngineerStatus.MANAGER
    return EngineerStatus.UNALLOCATED
