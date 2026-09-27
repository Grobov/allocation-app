"""Test fixtures.

The schema is created with the real Alembic migrations. By default tests run against a
temporary SQLite database; set ``TEST_DATABASE_URL`` to run them against PostgreSQL.
"""

import os
from collections.abc import Iterator
from datetime import date
from pathlib import Path
from typing import Any

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import Engine, text

from app.config import BACKEND_DIR, Settings
from app.db import build_engine
from app.main import create_app

TODAY = date(2026, 9, 27)


def alembic_config(url: str) -> Config:
    config = Config(str(BACKEND_DIR / "alembic.ini"))
    config.set_main_option("sqlalchemy.url", url)
    config.attributes["configure_logger"] = False
    return config


@pytest.fixture(scope="session")
def database_url(tmp_path_factory: pytest.TempPathFactory) -> str:
    url = os.environ.get("TEST_DATABASE_URL")
    if url:
        return url
    path: Path = tmp_path_factory.mktemp("db") / "test.db"
    return f"sqlite:///{path}"


@pytest.fixture(scope="session")
def engine(database_url: str) -> Iterator[Engine]:
    config = alembic_config(database_url)
    command.downgrade(config, "base")
    command.upgrade(config, "head")
    engine = build_engine(database_url)
    yield engine
    engine.dispose()


@pytest.fixture(autouse=True)
def _clean_tables(engine: Engine) -> Iterator[None]:
    yield
    with engine.begin() as conn:
        for table in ("allocations", "projects", "clusters", "engineers"):
            conn.execute(text(f"DELETE FROM {table}"))


class Clock:
    """Controllable 'today' for the application."""

    def __init__(self) -> None:
        self.today = TODAY

    def __call__(self) -> date:
        return self.today


@pytest.fixture
def clock() -> Clock:
    return Clock()


@pytest.fixture
def client(database_url: str, engine: Engine, clock: Clock) -> Iterator[TestClient]:
    settings = Settings(database_url=database_url, cors_origins=[])
    app = create_app(settings, today_provider=clock)
    with TestClient(app) as test_client:
        yield test_client
    app.state.engine.dispose()


class Api:
    """Small helper around the test client to create entities concisely."""

    def __init__(self, client: TestClient) -> None:
        self.client = client

    def _post(self, url: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = self.client.post(url, json=payload)
        assert response.status_code == 201, response.text
        data: dict[str, Any] = response.json()
        return data

    def engineer(self, full_name: str = "Anna Melnyk", comment: str = "") -> dict[str, Any]:
        return self._post("/api/v1/engineers", {"full_name": full_name, "comment": comment})

    def cluster(self, name: str = "Payments", qa_manager_id: int | None = None) -> dict[str, Any]:
        return self._post("/api/v1/clusters", {"name": name, "qa_manager_id": qa_manager_id})

    def project(self, cluster_id: int, name: str = "Payment Gateway") -> dict[str, Any]:
        return self._post(
            "/api/v1/projects", {"name": name, "cluster_id": cluster_id, "description": "d"}
        )

    def allocation(self, engineer_id: int, project_id: int, **extra: Any) -> dict[str, Any]:
        return self._post(
            "/api/v1/allocations",
            {"engineer_id": engineer_id, "project_id": project_id, **extra},
        )


@pytest.fixture
def api(client: TestClient) -> Api:
    return Api(client)
