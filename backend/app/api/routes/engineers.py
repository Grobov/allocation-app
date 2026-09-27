from fastapi import APIRouter, Response, status

from app.api.deps import SessionDep, TodayDep
from app.api.errors_doc import responses
from app.schemas import EngineerCreate, EngineerOverview, EngineerRead, EngineerUpdate
from app.services import engineers as service

router = APIRouter(prefix="/engineers", tags=["Engineers"])


@router.get("", response_model=list[EngineerRead], summary="List engineers")
def list_engineers(session: SessionDep) -> list[EngineerRead]:
    return service.list_engineers(session)


@router.get(
    "/overview",
    response_model=list[EngineerOverview],
    summary="Engineers with current allocations, totals and status",
)
def engineers_overview(session: SessionDep, today: TodayDep) -> list[EngineerOverview]:
    return service.engineers_overview(session, today)


@router.post(
    "",
    response_model=EngineerRead,
    status_code=status.HTTP_201_CREATED,
    responses=responses(409, 422),
    summary="Create an engineer",
)
def create_engineer(data: EngineerCreate, session: SessionDep) -> EngineerRead:
    return service.create_engineer(session, data)


@router.get(
    "/{engineer_id}", response_model=EngineerRead, responses=responses(404), summary="Get engineer"
)
def get_engineer(engineer_id: int, session: SessionDep) -> EngineerRead:
    return service.get_engineer(session, engineer_id)


@router.patch(
    "/{engineer_id}",
    response_model=EngineerRead,
    responses=responses(404, 409, 422),
    summary="Update an engineer",
)
def update_engineer(engineer_id: int, data: EngineerUpdate, session: SessionDep) -> EngineerRead:
    return service.update_engineer(session, engineer_id, data)


@router.delete(
    "/{engineer_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=responses(404, 409),
    summary="Delete an engineer",
    description="Blocked (409) while the engineer has active or planned allocations. "
    "Clusters managed by the engineer become unassigned; allocation history is kept.",
)
def delete_engineer(engineer_id: int, session: SessionDep, today: TodayDep) -> Response:
    service.delete_engineer(session, engineer_id, today)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
