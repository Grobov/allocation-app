from fastapi.testclient import TestClient

from tests.conftest import Api

URL = "/api/v1/projects"


def test_create_project_in_cluster(client: TestClient, api: Api) -> None:
    cluster = api.cluster("Payments")
    response = client.post(
        URL,
        json={
            "name": "Payment Gateway",
            "description": "Core card payment processing",
            "cluster_id": cluster["id"],
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["cluster"] == {"id": cluster["id"], "name": "Payments"}
    assert body["description"] == "Core card payment processing"


def test_create_requires_existing_cluster(client: TestClient) -> None:
    response = client.post(URL, json={"name": "P", "cluster_id": 42})
    assert response.status_code == 422
    assert "cluster_id" in response.json()["error"]["fields"]


def test_create_requires_cluster(client: TestClient) -> None:
    response = client.post(URL, json={"name": "P"})
    assert response.status_code == 422
    assert "cluster_id" in response.json()["error"]["fields"]


def test_names_are_unique_across_clusters(client: TestClient, api: Api) -> None:
    first = api.cluster("Payments")
    second = api.cluster("Core Platform")
    api.project(first["id"], "Gateway")
    response = client.post(URL, json={"name": "gateway", "cluster_id": second["id"]})
    assert response.status_code == 409


def test_filter_by_cluster(client: TestClient, api: Api) -> None:
    first = api.cluster("Payments")
    second = api.cluster("Core Platform")
    api.project(first["id"], "A")
    api.project(second["id"], "B")
    names = [p["name"] for p in client.get(URL, params={"cluster_id": second["id"]}).json()]
    assert names == ["B"]


def test_move_project_to_another_cluster_keeps_allocations(client: TestClient, api: Api) -> None:
    payments = api.cluster("Payments")
    core = api.cluster("Core Platform")
    project = api.project(payments["id"])
    engineer = api.engineer()
    api.allocation(engineer["id"], project["id"])

    response = client.patch(f"{URL}/{project['id']}", json={"cluster_id": core["id"]})
    assert response.status_code == 200
    assert response.json()["cluster"]["name"] == "Core Platform"

    dashboard = client.get("/api/v1/dashboard").json()
    by_name = {c["name"]: c for c in dashboard["clusters"]}
    assert by_name["Payments"]["projects"] == []
    moved = by_name["Core Platform"]["projects"][0]
    assert moved["name"] == "Payment Gateway"
    assert len(moved["allocations"]) == 1


def test_update_rejects_null_cluster(client: TestClient, api: Api) -> None:
    project = api.project(api.cluster()["id"])
    response = client.patch(f"{URL}/{project['id']}", json={"cluster_id": None})
    assert response.status_code == 422


def test_update_rejects_unknown_cluster(client: TestClient, api: Api) -> None:
    project = api.project(api.cluster()["id"])
    response = client.patch(f"{URL}/{project['id']}", json={"cluster_id": 999})
    assert response.status_code == 422


def test_delete_project_without_allocations(client: TestClient, api: Api) -> None:
    project = api.project(api.cluster()["id"])
    assert client.delete(f"{URL}/{project['id']}").status_code == 204
    assert client.get(f"{URL}/{project['id']}").status_code == 404


def test_delete_blocked_by_current_allocation_then_history_kept(
    client: TestClient, api: Api
) -> None:
    project = api.project(api.cluster()["id"])
    engineer = api.engineer()
    allocation = api.allocation(engineer["id"], project["id"])

    response = client.delete(f"{URL}/{project['id']}")
    assert response.status_code == 409
    assert "current allocation" in response.json()["error"]["message"]

    assert client.post(f"/api/v1/allocations/{allocation['id']}/end").status_code == 200
    assert client.delete(f"{URL}/{project['id']}").status_code == 204

    # The ended allocation is still available as history.
    history = client.get("/api/v1/allocations", params={"engineer_id": engineer["id"]}).json()
    assert [a["id"] for a in history] == [allocation["id"]]
    assert history[0]["project"]["name"] == "Payment Gateway"


def test_cannot_create_project_in_deleted_cluster(client: TestClient, api: Api) -> None:
    cluster = api.cluster()
    client.delete(f"/api/v1/clusters/{cluster['id']}")
    response = client.post(URL, json={"name": "P", "cluster_id": cluster["id"]})
    assert response.status_code == 422
