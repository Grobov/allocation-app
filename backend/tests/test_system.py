from pathlib import Path

from alembic import command
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, inspect

from app.config import Settings
from app.main import create_app
from tests.conftest import alembic_config


def test_health(client: TestClient) -> None:
    assert client.get("/api/v1/health").json() == {"status": "ok", "database": "ok"}


def test_unknown_route_uses_error_format(client: TestClient) -> None:
    response = client.get("/api/v1/nope")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"


def test_openapi_documents_all_resources(client: TestClient) -> None:
    paths = client.get("/api/openapi.json").json()["paths"]
    for path in (
        "/api/v1/clusters",
        "/api/v1/clusters/{cluster_id}",
        "/api/v1/projects/{project_id}",
        "/api/v1/engineers/overview",
        "/api/v1/allocations/{allocation_id}/end",
        "/api/v1/dashboard",
    ):
        assert path in paths
    assert client.get("/api/docs").status_code == 200


def test_migrations_upgrade_and_downgrade(tmp_path: Path) -> None:
    url = f"sqlite:///{tmp_path / 'migrations.db'}"
    config = alembic_config(url)
    command.upgrade(config, "head")
    engine = create_engine(url)
    tables = set(inspect(engine).get_table_names())
    assert {"engineers", "clusters", "projects", "allocations"} <= tables
    command.downgrade(config, "base")
    assert set(inspect(engine).get_table_names()) == {"alembic_version"}
    engine.dispose()


def test_serves_frontend_build(tmp_path: Path, database_url: str) -> None:
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<div id=root></div>")
    (tmp_path / "assets" / "app.js").write_text("console.log(1)")
    app = create_app(Settings(database_url=database_url, frontend_dist=tmp_path))
    with TestClient(app) as client:
        assert client.get("/").text == "<div id=root></div>"
        assert client.get("/engineers").text == "<div id=root></div>"  # SPA route
        assert client.get("/assets/app.js").text == "console.log(1)"
        assert client.get("/api/v1/unknown").status_code == 404
        assert client.get("/api/v1/health").status_code == 200
    app.state.engine.dispose()


def test_provider_postgres_urls_use_psycopg_driver() -> None:
    for url in ("postgres://u:p@host:5432/db", "postgresql://u:p@host:5432/db"):
        assert Settings(database_url=url).database_url == "postgresql+psycopg://u:p@host:5432/db"
    explicit = "postgresql+psycopg://u:p@host/db"
    assert Settings(database_url=explicit).database_url == explicit
    assert Settings(database_url="sqlite:///x.db").database_url == "sqlite:///x.db"
