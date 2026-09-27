from fastapi.testclient import TestClient
from sqlalchemy import Engine
from sqlalchemy.orm import Session

from app.seed import seed
from tests.conftest import TODAY


def test_dashboard_with_seed_data(client: TestClient, engine: Engine) -> None:
    with Session(engine) as session:
        assert seed(session, TODAY) is True
        assert seed(session, TODAY) is False  # idempotent

    dashboard = client.get("/api/v1/dashboard").json()
    assert dashboard["today"] == str(TODAY)
    assert dashboard["summary"] == {
        "clusters": 3,
        "projects": 5,
        "engineers": 8,
        "unallocated_engineers": 1,
    }

    clusters = {c["name"]: c for c in dashboard["clusters"]}
    assert list(clusters) == ["Payments", "Core Platform", "New Initiatives"]
    assert clusters["Payments"]["qa_manager"]["full_name"] == "Olena Kovalenko"
    assert clusters["New Initiatives"]["qa_manager"] is None
    assert clusters["New Initiatives"]["projects"] == []  # cluster without projects

    projects = {p["name"]: p for p in clusters["Core Platform"]["projects"]}
    # Project without allocations (the ended historical allocation is not shown).
    assert projects["Notification Service"]["allocations"] == []
    planned = projects["Data Platform"]["allocations"][0]
    assert planned["status"] == "planned"
    assert planned["engineer"]["full_name"] == "Kateryna Romanenko"

    gateway = clusters["Payments"]["projects"][0]
    assert [
        (a["engineer"]["full_name"], a["role"], a["percent"]) for a in gateway["allocations"]
    ] == [
        ("Anna Melnyk", "QC", 100),
        ("Maksym Bondar", "QC Lead", 50),
    ]

    # History is preserved but not displayed.
    ended = client.get("/api/v1/allocations", params={"status": "ended"}).json()
    assert [a["engineer"]["full_name"] for a in ended] == ["Andrii Koval"]


def test_empty_dashboard(client: TestClient) -> None:
    dashboard = client.get("/api/v1/dashboard").json()
    assert dashboard["clusters"] == []
    assert dashboard["summary"] == {
        "clusters": 0,
        "projects": 0,
        "engineers": 0,
        "unallocated_engineers": 0,
    }
