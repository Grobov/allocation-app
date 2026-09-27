"""Allocation business rules.

Status is derived from the dates and the explicit "ended" marker:

* ``ended``   - explicitly ended (``ended_at`` set) or its ``end_date`` is in the past;
* ``planned`` - starts after today;
* ``active``  - otherwise.

"Current" allocations are the active and planned ones. Validation rules on create/update:

* the engineer can hold at most one current allocation per project for any given day;
* the engineer's combined allocation may not exceed 100% on any day;
* ended allocations are read-only history.
"""

from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import ColumnElement, Select, func, or_, select
from sqlalchemy.orm import Session, joinedload

from app.errors import ConflictError, DomainValidationError, NotFoundError
from app.models import Allocation, Engineer, Project
from app.schemas import AllocationCreate, AllocationRead, AllocationStatus, AllocationUpdate
from app.services.common import format_date, get_live_reference, utcnow

MAX_TOTAL_PERCENT = 100


def allocation_status(allocation: Allocation, today: date) -> AllocationStatus:
    if allocation.ended_at is not None or (
        allocation.end_date is not None and allocation.end_date < today
    ):
        return AllocationStatus.ENDED
    if allocation.start_date > today:
        return AllocationStatus.PLANNED
    return AllocationStatus.ACTIVE


def current_clause(today: date) -> ColumnElement[bool]:
    """SQL filter matching active + planned allocations."""
    return Allocation.ended_at.is_(None) & or_(
        Allocation.end_date.is_(None), Allocation.end_date >= today
    )


def status_clause(status: AllocationStatus, today: date) -> ColumnElement[bool]:
    if status is AllocationStatus.PLANNED:
        return current_clause(today) & (Allocation.start_date > today)
    if status is AllocationStatus.ACTIVE:
        return current_clause(today) & (Allocation.start_date <= today)
    return Allocation.ended_at.is_not(None) | (Allocation.end_date < today)


def to_read(allocation: Allocation, today: date) -> AllocationRead:
    return AllocationRead.model_validate(
        {
            **{c: getattr(allocation, c) for c in AllocationRead.model_fields if c != "status"},
            "status": allocation_status(allocation, today),
        }
    )


@dataclass(frozen=True)
class Period:
    start: date
    end: date | None  # inclusive, None = open-ended
    percent: int


def peak_load(periods: Iterable[Period], window: Period) -> tuple[int, date | None]:
    """Maximum combined percentage of ``periods`` within ``window`` and the first day it occurs."""
    events: list[tuple[date, int]] = []
    for period in periods:
        start = max(period.start, window.start)
        end = _min_end(period.end, window.end)
        if end is not None and end < start:
            continue
        events.append((start, period.percent))
        if end is not None:
            events.append((end + timedelta(days=1), -period.percent))

    # At equal dates, releases (negative deltas) are processed before new allocations.
    events.sort()
    load, peak, peak_day = 0, 0, None
    for day, delta in events:
        load += delta
        if load > peak:
            peak, peak_day = load, day
    return peak, peak_day


def _min_end(a: date | None, b: date | None) -> date | None:
    if a is None:
        return b
    if b is None:
        return a
    return min(a, b)


def _overlaps(a: Period, b: Period) -> bool:
    return (a.end is None or b.start <= a.end) and (b.end is None or a.start <= b.end)


def _base_query() -> Select[Allocation]:
    return select(Allocation).options(
        joinedload(Allocation.engineer), joinedload(Allocation.project)
    )


def list_allocations(
    session: Session,
    today: date,
    *,
    engineer_id: int | None = None,
    project_id: int | None = None,
    statuses: Sequence[AllocationStatus] = (),
) -> list[AllocationRead]:
    query = _base_query()
    if engineer_id is not None:
        query = query.where(Allocation.engineer_id == engineer_id)
    if project_id is not None:
        query = query.where(Allocation.project_id == project_id)
    if statuses:
        query = query.where(or_(*(status_clause(s, today) for s in statuses)))
    rows = session.scalars(query.order_by(Allocation.id)).all()
    return [to_read(a, today) for a in rows]


def _get_or_404(session: Session, allocation_id: int) -> Allocation:
    allocation = session.scalar(_base_query().where(Allocation.id == allocation_id))
    if allocation is None:
        raise NotFoundError(f"Allocation {allocation_id} was not found.")
    return allocation


def get_allocation(session: Session, allocation_id: int, today: date) -> AllocationRead:
    return to_read(_get_or_404(session, allocation_id), today)


def _validate_period_and_load(
    session: Session,
    *,
    engineer: Engineer,
    project: Project,
    candidate: Period,
    today: date,
    exclude_id: int | None = None,
) -> None:
    if candidate.end is not None and candidate.end < today:
        message = "End date cannot be in the past. Use “End allocation” to finish it."
        raise DomainValidationError(message, fields={"end_date": message})

    # Only today onwards is validated: history is not re-checked retroactively.
    window = Period(max(candidate.start, today), candidate.end, candidate.percent)

    query = select(Allocation).where(Allocation.engineer_id == engineer.id, current_clause(today))
    if exclude_id is not None:
        query = query.where(Allocation.id != exclude_id)
    others = session.scalars(query).all()

    for other in others:
        other_period = Period(other.start_date, other.end_date, other.percent)
        if other.project_id == project.id and _overlaps(window, other_period):
            raise ConflictError(
                f"{engineer.full_name} is already allocated to {project.name} "
                "for an overlapping period.",
                fields={"engineer_id": "Already allocated to this project."},
            )

    periods = [Period(o.start_date, o.end_date, o.percent) for o in others]
    peak, peak_day = peak_load([*periods, window], window)
    if peak > MAX_TOTAL_PERCENT and peak_day is not None:
        message = (
            f"{engineer.full_name} would be allocated {peak}% from {format_date(peak_day)} "
            f"(maximum is {MAX_TOTAL_PERCENT}%)."
        )
        raise DomainValidationError(message, fields={"percent": message})


def create_allocation(session: Session, data: AllocationCreate, today: date) -> AllocationRead:
    engineer = get_live_reference(session, Engineer, data.engineer_id, "engineer_id")
    project = get_live_reference(session, Project, data.project_id, "project_id")
    start = data.start_date or today
    if data.end_date is not None and data.end_date < start:
        message = "End date cannot be before the start date."
        raise DomainValidationError(message, fields={"end_date": message})

    _validate_period_and_load(
        session,
        engineer=engineer,
        project=project,
        candidate=Period(start, data.end_date, data.percent),
        today=today,
    )

    allocation = Allocation(
        engineer=engineer,
        project=project,
        role=data.role,
        percent=data.percent,
        comment=data.comment,
        start_date=start,
        end_date=data.end_date,
    )
    session.add(allocation)
    session.commit()
    return get_allocation(session, allocation.id, today)


def update_allocation(
    session: Session, allocation_id: int, data: AllocationUpdate, today: date
) -> AllocationRead:
    allocation = _get_or_404(session, allocation_id)
    if allocation_status(allocation, today) is AllocationStatus.ENDED:
        raise ConflictError("Ended allocations are kept as history and cannot be modified.")

    changes = data.changes()
    start = changes.get("start_date", allocation.start_date)
    end = changes.get("end_date", allocation.end_date)
    percent = changes.get("percent", allocation.percent)
    if end is not None and end < start:
        message = "End date cannot be before the start date."
        raise DomainValidationError(message, fields={"end_date": message})

    _validate_period_and_load(
        session,
        engineer=allocation.engineer,
        project=allocation.project,
        candidate=Period(start, end, percent),
        today=today,
        exclude_id=allocation.id,
    )

    for field, value in changes.items():
        setattr(allocation, field, value)
    session.commit()
    return get_allocation(session, allocation.id, today)


def end_allocation(session: Session, allocation_id: int, today: date) -> AllocationRead:
    """End an allocation, keeping it as history.

    An active allocation ends today; a planned one is cancelled (its dates are kept).
    """
    allocation = _get_or_404(session, allocation_id)
    status = allocation_status(allocation, today)
    if status is AllocationStatus.ENDED:
        raise ConflictError("This allocation has already ended.")
    if status is AllocationStatus.ACTIVE and (
        allocation.end_date is None or allocation.end_date > today
    ):
        allocation.end_date = today
    allocation.ended_at = utcnow()
    session.commit()
    return get_allocation(session, allocation.id, today)


def count_current(
    session: Session,
    today: date,
    *,
    engineer_id: int | None = None,
    project_id: int | None = None,
) -> int:
    query = select(func.count(Allocation.id)).where(current_clause(today))
    if engineer_id is not None:
        query = query.where(Allocation.engineer_id == engineer_id)
    if project_id is not None:
        query = query.where(Allocation.project_id == project_id)
    return session.scalar(query) or 0
