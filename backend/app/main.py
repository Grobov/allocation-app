"""FastAPI application factory."""

import logging
from collections.abc import Callable
from datetime import date
from pathlib import Path

from fastapi import APIRouter, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from app.api.routes import allocations, clusters, engineers, projects, system
from app.config import Settings, get_settings
from app.db import build_engine, build_sessionmaker
from app.errors import register_error_handlers

API_PREFIX = "/api/v1"

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")


def create_app(
    settings: Settings | None = None, *, today_provider: Callable[[], date] | None = None
) -> FastAPI:
    settings = settings or get_settings()

    app = FastAPI(
        title="QA Allocation API",
        version="1.0.0",
        description="Manage clusters, projects, QA engineers and their project allocations.",
        docs_url="/api/docs",
        redoc_url="/api/redoc",
        openapi_url="/api/openapi.json",
    )

    engine = build_engine(settings.database_url, echo=settings.sql_echo)
    app.state.engine = engine
    app.state.sessionmaker = build_sessionmaker(engine)
    app.state.today_provider = today_provider or settings.today

    if settings.cors_origins:
        app.add_middleware(
            CORSMiddleware,
            allow_origins=settings.cors_origins,
            allow_methods=["GET", "POST", "PATCH", "DELETE"],
            allow_headers=["Content-Type"],
        )

    register_error_handlers(app)

    api = APIRouter(prefix=API_PREFIX)
    for module in (system, clusters, projects, engineers, allocations):
        api.include_router(module.router)
    app.include_router(api)

    if settings.frontend_dist:
        _mount_frontend(app, settings.frontend_dist)

    return app


def _mount_frontend(app: FastAPI, dist: Path) -> None:
    """Serve the built single-page app, falling back to index.html for client routes."""
    index = dist / "index.html"
    if not index.is_file():
        raise RuntimeError(f"FRONTEND_DIST={dist} does not contain index.html")
    if (dist / "assets").is_dir():
        app.mount("/assets", StaticFiles(directory=dist / "assets"), name="assets")
    root = dist.resolve()

    @app.get("/{path:path}", include_in_schema=False)
    def spa(path: str) -> FileResponse:
        if path == "api" or path.startswith("api/"):
            raise HTTPException(status_code=404, detail="Not Found")
        candidate = (root / path).resolve()
        if path and candidate.is_file() and candidate.is_relative_to(root):
            return FileResponse(candidate)
        return FileResponse(index)


app = create_app()
