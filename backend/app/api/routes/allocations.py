from fastapi import APIRouter, Query, status

from app.api.deps import SessionDep, TodayDep
from app.api.errors_doc import responses
from app.schemas import AllocationCreate, AllocationRead, AllocationStatus, AllocationUpdate
from app.services import allocations as service

router = APIRouter(prefix="/allocations", tags=["Allocations"])


@router.get("", response_model=list[AllocationRead], summary="List allocations")
def list_allocations(
    session: SessionDep,
    today: TodayDep,
    engineer_id: int | None = Query(default=None),
    project_id: int | None = Query(default=None),
    status_filter: list[AllocationStatus] = Query(
        default=[],
        alias="status",
        description="Filter by status; repeat to combine (e.g. `?status=active&status=planned`).",
    ),
) -> list[AllocationRead]:
    return service.list_allocations(
        session, today, engineer_id=engineer_id, project_id=project_id, statuses=status_filter
    )


@router.post(
    "",
    response_model=AllocationRead,
    status_code=status.HTTP_201_CREATED,
    responses=responses(409, 422),
    summary="Allocate an engineer to a project",
    description="Rejected if the engineer is already allocated to the project for an "
    "overlapping period (409) or would exceed 100% on any day (422).",
)
def create_allocation(
    data: AllocationCreate, session: SessionDep, today: TodayDep
) -> AllocationRead:
    return service.create_allocation(session, data, today)


@router.get(
    "/{allocation_id}",
    response_model=AllocationRead,
    responses=responses(404),
    summary="Get allocation",
)
def get_allocation(allocation_id: int, session: SessionDep, today: TodayDep) -> AllocationRead:
    return service.get_allocation(session, allocation_id, today)


@router.patch(
    "/{allocation_id}",
    response_model=AllocationRead,
    responses=responses(404, 409, 422),
    summary="Update an allocation",
    description="Role, percentage, comment and dates can be changed. The engineer and project "
    "are fixed. Ended allocations cannot be modified (409).",
)
def update_allocation(
    allocation_id: int, data: AllocationUpdate, session: SessionDep, today: TodayDep
) -> AllocationRead:
    return service.update_allocation(session, allocation_id, data, today)


@router.post(
    "/{allocation_id}/end",
    response_model=AllocationRead,
    responses=responses(404, 409),
    summary="End an allocation",
    description="An active allocation ends today; a planned one is cancelled. The allocation "
    "is kept as history (allocations are never deleted).",
)
def end_allocation(allocation_id: int, session: SessionDep, today: TodayDep) -> AllocationRead:
    return service.end_allocation(session, allocation_id, today)
