from fastapi import APIRouter, Query, Response, status

from app.api.deps import SessionDep, TodayDep
from app.api.errors_doc import responses
from app.schemas import ProjectCreate, ProjectRead, ProjectUpdate
from app.services import projects as service

router = APIRouter(prefix="/projects", tags=["Projects"])


@router.get("", response_model=list[ProjectRead], summary="List projects")
def list_projects(
    session: SessionDep,
    cluster_id: int | None = Query(default=None, description="Only projects of this cluster."),
) -> list[ProjectRead]:
    return service.list_projects(session, cluster_id=cluster_id)


@router.post(
    "",
    response_model=ProjectRead,
    status_code=status.HTTP_201_CREATED,
    responses=responses(409, 422),
    summary="Create a project in a cluster",
)
def create_project(data: ProjectCreate, session: SessionDep) -> ProjectRead:
    return service.create_project(session, data)


@router.get(
    "/{project_id}", response_model=ProjectRead, responses=responses(404), summary="Get project"
)
def get_project(project_id: int, session: SessionDep) -> ProjectRead:
    return service.get_project(session, project_id)


@router.patch(
    "/{project_id}",
    response_model=ProjectRead,
    responses=responses(404, 409, 422),
    summary="Update a project",
    description="Setting `cluster_id` moves the project (with its allocations) to that cluster.",
)
def update_project(project_id: int, data: ProjectUpdate, session: SessionDep) -> ProjectRead:
    return service.update_project(session, project_id, data)


@router.delete(
    "/{project_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=responses(404, 409),
    summary="Delete a project",
    description="Blocked (409) while the project has active or planned allocations. "
    "Allocation history is kept.",
)
def delete_project(project_id: int, session: SessionDep, today: TodayDep) -> Response:
    service.delete_project(session, project_id, today)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
