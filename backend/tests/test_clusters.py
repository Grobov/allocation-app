from fastapi.testclient import TestClient

from tests.conftest import Api

URL = "/api/v1/clusters"


def test_create_and_get_cluster_with_manager(client: TestClient, api: Api) -> None:
    manager = api.engineer("Olena Kovalenko")
    created = api.cluster("  Payments  ", qa_manager_id=manager["id"])

    assert created["name"] == "Payments"  # whitespace is trimmed
    assert created["qa_manager"] == {"id": manager["id"], "full_name": "Olena Kovalenko"}

    response = client.get(f"{URL}/{created['id']}")
    assert response.status_code == 200
    assert response.json()["qa_manager_id"] == manager["id"]


def test_create_cluster_without_manager(api: Api) -> None:
    created = api.cluster("New Initiatives")
    assert created["qa_manager"] is None


def test_list_clusters_in_creation_order(client: TestClient, api: Api) -> None:
    for name in ("Payments", "Core Platform", "New Initiatives"):
        api.cluster(name)
    names = [c["name"] for c in client.get(URL).json()]
    assert names == ["Payments", "Core Platform", "New Initiatives"]


def test_duplicate_name_is_rejected_case_insensitively(client: TestClient, api: Api) -> None:
    api.cluster("Payments")
    response = client.post(URL, json={"name": "PAYMENTS"})
    assert response.status_code == 409
    body = response.json()["error"]
    assert body["code"] == "conflict"
    assert "name" in body["fields"]


def test_blank_name_is_rejected(client: TestClient) -> None:
    response = client.post(URL, json={"name": "   "})
    assert response.status_code == 422
    error = response.json()["error"]
    assert error["code"] == "validation_error"
    assert "name" in error["fields"]


def test_unknown_fields_are_rejected(client: TestClient) -> None:
    response = client.post(URL, json={"name": "X", "unexpected": 1})
    assert response.status_code == 422
    assert "unexpected" in response.json()["error"]["fields"]


def test_unknown_manager_is_rejected(client: TestClient) -> None:
    response = client.post(URL, json={"name": "Payments", "qa_manager_id": 999})
    assert response.status_code == 422
    assert "qa_manager_id" in response.json()["error"]["fields"]


def test_update_name_and_manager(client: TestClient, api: Api) -> None:
    cluster = api.cluster("Payments")
    manager = api.engineer("Dmytro Hrytsenko")

    response = client.patch(
        f"{URL}/{cluster['id']}", json={"name": "Payments EU", "qa_manager_id": manager["id"]}
    )
    assert response.status_code == 200
    assert response.json()["name"] == "Payments EU"
    assert response.json()["qa_manager"]["full_name"] == "Dmytro Hrytsenko"

    # Unassign the manager.
    response = client.patch(f"{URL}/{cluster['id']}", json={"qa_manager_id": None})
    assert response.status_code == 200
    assert response.json()["qa_manager"] is None


def test_update_keeps_own_name(client: TestClient, api: Api) -> None:
    cluster = api.cluster("Payments")
    response = client.patch(f"{URL}/{cluster['id']}", json={"name": "payments"})
    assert response.status_code == 200


def test_update_rejects_null_name(client: TestClient, api: Api) -> None:
    cluster = api.cluster("Payments")
    response = client.patch(f"{URL}/{cluster['id']}", json={"name": None})
    assert response.status_code == 422


def test_delete_empty_cluster_and_reuse_name(client: TestClient, api: Api) -> None:
    cluster = api.cluster("Payments")
    assert client.delete(f"{URL}/{cluster['id']}").status_code == 204
    assert client.get(f"{URL}/{cluster['id']}").status_code == 404
    assert client.get(URL).json() == []
    # The name becomes available again after deletion.
    api.cluster("Payments")


def test_delete_cluster_with_projects_is_blocked(client: TestClient, api: Api) -> None:
    cluster = api.cluster("Payments")
    api.project(cluster["id"])
    response = client.delete(f"{URL}/{cluster['id']}")
    assert response.status_code == 409
    assert "project" in response.json()["error"]["message"]


def test_not_found(client: TestClient) -> None:
    assert client.get(f"{URL}/999").status_code == 404
    assert client.patch(f"{URL}/999", json={"name": "x"}).status_code == 404
    response = client.delete(f"{URL}/999")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "not_found"
