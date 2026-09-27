from datetime import timedelta

from fastapi.testclient import TestClient

from tests.conftest import TODAY, Api

URL = "/api/v1/engineers"


def test_engineer_crud(client: TestClient) -> None:
    response = client.post(
        URL, json={"full_name": "Oleksii Marchenko", "comment": "Manual and API testing"}
    )
    assert response.status_code == 201
    engineer = response.json()
    assert engineer["comment"] == "Manual and API testing"

    response = client.patch(f"{URL}/{engineer['id']}", json={"comment": "Mobile testing"})
    assert response.status_code == 200
    assert response.json()["comment"] == "Mobile testing"
    assert response.json()["full_name"] == "Oleksii Marchenko"

    assert [e["full_name"] for e in client.get(URL).json()] == ["Oleksii Marchenko"]
    assert client.delete(f"{URL}/{engineer['id']}").status_code == 204
    assert client.get(f"{URL}/{engineer['id']}").status_code == 404


def test_comment_is_optional(client: TestClient) -> None:
    response = client.post(URL, json={"full_name": "Andrii Koval"})
    assert response.status_code == 201
    assert response.json()["comment"] == ""


def test_name_validation(client: TestClient, api: Api) -> None:
    assert client.post(URL, json={"full_name": ""}).status_code == 422
    assert client.post(URL, json={"full_name": "x" * 121}).status_code == 422
    api.engineer("Anna Melnyk")
    assert client.post(URL, json={"full_name": "anna melnyk"}).status_code == 409


def test_delete_blocked_while_allocated(client: TestClient, api: Api) -> None:
    engineer = api.engineer()
    project = api.project(api.cluster()["id"])
    api.allocation(engineer["id"], project["id"])
    response = client.delete(f"{URL}/{engineer['id']}")
    assert response.status_code == 409
    assert "End them" in response.json()["error"]["message"]


def test_delete_manager_unassigns_cluster(client: TestClient, api: Api) -> None:
    manager = api.engineer("Olena Kovalenko")
    cluster = api.cluster("Payments", qa_manager_id=manager["id"])
    assert client.delete(f"{URL}/{manager['id']}").status_code == 204
    assert client.get(f"/api/v1/clusters/{cluster['id']}").json()["qa_manager"] is None


def test_overview_statuses_and_totals(client: TestClient, api: Api) -> None:
    cluster = api.cluster("Payments")
    gateway = api.project(cluster["id"], "Payment Gateway")
    portal = api.project(cluster["id"], "Merchant Portal")

    anna = api.engineer("Anna Melnyk")
    maksym = api.engineer("Maksym Bondar")
    kateryna = api.engineer("Kateryna Romanenko")
    andrii = api.engineer("Andrii Koval")
    olena = api.engineer("Olena Kovalenko")
    client.patch(f"/api/v1/clusters/{cluster['id']}", json={"qa_manager_id": olena["id"]})

    api.allocation(anna["id"], gateway["id"])
    api.allocation(maksym["id"], gateway["id"], role="QC Lead", percent=50)
    api.allocation(maksym["id"], portal["id"], percent=25)
    api.allocation(
        kateryna["id"],
        portal["id"],
        percent=50,
        start_date=str(TODAY + timedelta(days=4)),
        end_date=str(TODAY + timedelta(days=95)),
    )

    overview = {e["full_name"]: e for e in client.get(f"{URL}/overview").json()}

    assert overview["Anna Melnyk"]["status"] == "allocated"
    assert overview["Anna Melnyk"]["total_percent"] == 100
    assert overview["Maksym Bondar"]["total_percent"] == 75
    assert [
        (a["project"]["name"], a["role"]) for a in overview["Maksym Bondar"]["allocations"]
    ] == [
        ("Payment Gateway", "QC Lead"),
        ("Merchant Portal", "QC"),
    ]
    assert overview["Kateryna Romanenko"]["status"] == "planned"
    assert overview["Kateryna Romanenko"]["total_percent"] == 50
    assert overview["Andrii Koval"]["status"] == "unallocated"
    assert overview["Andrii Koval"]["total_percent"] == 0
    assert overview["Olena Kovalenko"]["status"] == "manager"
    assert overview["Olena Kovalenko"]["managed_clusters"] == [
        {"id": cluster["id"], "name": "Payments"}
    ]
    assert list(overview) == [
        "Anna Melnyk",
        "Maksym Bondar",
        "Kateryna Romanenko",
        "Andrii Koval",
        "Olena Kovalenko",
    ]
    del andrii


def test_overview_total_is_peak_not_sum_of_sequential(client: TestClient, api: Api) -> None:
    engineer = api.engineer()
    cluster = api.cluster()
    first = api.project(cluster["id"], "A")
    second = api.project(cluster["id"], "B")
    api.allocation(engineer["id"], first["id"], end_date=str(TODAY + timedelta(days=10)))
    api.allocation(
        engineer["id"], second["id"], percent=60, start_date=str(TODAY + timedelta(days=11))
    )
    overview = client.get(f"{URL}/overview").json()[0]
    assert overview["total_percent"] == 100
    assert len(overview["allocations"]) == 2
