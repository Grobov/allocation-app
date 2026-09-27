from fastapi import APIRouter
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.api.deps import SessionDep, TodayDep
from app.schemas import Dashboard, Health
from app.services.dashboard import build_dashboard

router = APIRouter()


@router.get(
    "/dashboard",
    response_model=Dashboard,
    tags=["Dashboard"],
    summary="Clusters, projects and current allocations with summary metrics",
    description="Single read model for the Allocation Dashboard. Includes active and planned "
    "allocations; ended allocations are omitted.",
)
def get_dashboard(session: SessionDep, today: TodayDep) -> Dashboard:
    return build_dashboard(session, today)


@router.get("/health", response_model=Health, tags=["System"], summary="Health check")
def health(session: SessionDep) -> Health | JSONResponse:
    try:
        session.execute(text("SELECT 1"))
    except Exception:
        return JSONResponse(status_code=503, content={"status": "error", "database": "unavailable"})
    return Health(status="ok", database="ok")
