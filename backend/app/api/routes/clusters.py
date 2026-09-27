from fastapi import APIRouter, Response, status

from app.api.deps import SessionDep
from app.api.errors_doc import responses
from app.schemas import ClusterCreate, ClusterRead, ClusterUpdate
from app.services import clusters as service

router = APIRouter(prefix="/clusters", tags=["Clusters"])


@router.get("", response_model=list[ClusterRead], summary="List clusters")
def list_clusters(session: SessionDep) -> list[ClusterRead]:
    return service.list_clusters(session)


@router.post(
    "",
    response_model=ClusterRead,
    status_code=status.HTTP_201_CREATED,
    responses=responses(409, 422),
    summary="Create a cluster",
)
def create_cluster(data: ClusterCreate, session: SessionDep) -> ClusterRead:
    return service.create_cluster(session, data)


@router.get(
    "/{cluster_id}", response_model=ClusterRead, responses=responses(404), summary="Get cluster"
)
def get_cluster(cluster_id: int, session: SessionDep) -> ClusterRead:
    return service.get_cluster(session, cluster_id)


@router.patch(
    "/{cluster_id}",
    response_model=ClusterRead,
    responses=responses(404, 409, 422),
    summary="Update a cluster (name, QA Manager)",
)
def update_cluster(cluster_id: int, data: ClusterUpdate, session: SessionDep) -> ClusterRead:
    return service.update_cluster(session, cluster_id, data)


@router.delete(
    "/{cluster_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    responses=responses(404, 409),
    summary="Delete a cluster",
    description="Only clusters without projects can be deleted (409 otherwise).",
)
def delete_cluster(cluster_id: int, session: SessionDep) -> Response:
    service.delete_cluster(session, cluster_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
