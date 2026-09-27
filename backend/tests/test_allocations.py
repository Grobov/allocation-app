from datetime import timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import TODAY, Api, Clock

URL = "/api/v1/allocations"


@pytest.fixture
def setup(api: Api) -> dict[str, dict[str, Any]]:
    cluster = api.cluster("Payments")
    return {
        "anna": api.engineer("Anna Melnyk"),
        "maksym": api.engineer("Maksym Bondar"),
        "gateway": api.project(cluster["id"], "Payment Gateway"),
        "portal": api.project(cluster["id"], "Merchant Portal"),
    }


def day(offset: int) -> str:
    return str(TODAY + timedelta(days=offset))


def test_create_with_defaults(client: TestClient, setup: dict[str, dict[str, Any]]) -> None:
    response = client.post(
        URL, json={"engineer_id": setup["anna"]["id"], "project_id": setup["gateway"]["id"]}
    )
    assert response.status_code == 201
    body = response.json()
    assert body["role"] == "QC"
    assert body["percent"] == 100
    assert body["start_date"] == str(TODAY)
    assert body["end_date"] is None
    assert body["status"] == "active"
    assert body["engineer"]["full_name"] == "Anna Melnyk"
    assert body["project"]["name"] == "Payment Gateway"


def test_create_planned(api: Api, setup: dict[str, dict[str, Any]]) -> None:
    body = api.allocation(
        setup["anna"]["id"],
        setup["gateway"]["id"],
        role="QC Lead",
        percent=50,
        comment="  Planned work  ",
        start_date=day(4),
        end_date=day(95),
    )
    assert body["status"] == "planned"
    assert body["role"] == "QC Lead"
    assert body["comment"] == "Planned work"


@pytest.mark.parametrize(
    ("payload", "field"),
    [
        ({"percent": 0}, "percent"),
        ({"percent": 101}, "percent"),
        ({"percent": "abc"}, "percent"),
        ({"role": "Manager"}, "role"),
        ({"start_date": "not-a-date"}, "start_date"),
        ({"engineer_id": 999}, "engineer_id"),
        ({"project_id": 999}, "project_id"),
        ({"start_date": day(10), "end_date": day(5)}, "request"),
        ({"start_date": day(-10), "end_date": day(-1)}, "end_date"),
    ],
)
def test_create_validation(
    client: TestClient,
    setup: dict[str, dict[str, Any]],
    payload: dict[str, object],
    field: str,
) -> None:
    body = {"engineer_id": setup["anna"]["id"], "project_id": setup["gateway"]["id"], **payload}
    response = client.post(URL, json=body)
    assert response.status_code == 422, response.text
    assert field in response.json()["error"]["fields"]


def test_engineer_can_be_on_multiple_projects(api: Api, setup: dict[str, dict[str, Any]]) -> None:
    api.allocation(setup["maksym"]["id"], setup["gateway"]["id"], role="QC Lead", percent=50)
    api.allocation(setup["maksym"]["id"], setup["portal"]["id"], percent=25)


def test_duplicate_allocation_to_same_project_is_rejected(
    client: TestClient, api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    api.allocation(setup["anna"]["id"], setup["gateway"]["id"], percent=20)
    response = client.post(
        URL,
        json={
            "engineer_id": setup["anna"]["id"],
            "project_id": setup["gateway"]["id"],
            "percent": 20,
        },
    )
    assert response.status_code == 409


def test_same_project_allowed_for_non_overlapping_period(
    api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    api.allocation(setup["anna"]["id"], setup["gateway"]["id"], end_date=day(5))
    api.allocation(setup["anna"]["id"], setup["gateway"]["id"], start_date=day(6))


def test_over_allocation_is_rejected(
    client: TestClient, api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    api.allocation(setup["anna"]["id"], setup["gateway"]["id"], percent=80)
    response = client.post(
        URL,
        json={
            "engineer_id": setup["anna"]["id"],
            "project_id": setup["portal"]["id"],
            "percent": 30,
        },
    )
    assert response.status_code == 422
    error = response.json()["error"]
    assert "110%" in error["message"]
    assert "percent" in error["fields"]


def test_over_allocation_only_counts_overlapping_periods(
    api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    api.allocation(setup["anna"]["id"], setup["gateway"]["id"], percent=80, end_date=day(9))
    api.allocation(setup["anna"]["id"], setup["portal"]["id"], percent=100, start_date=day(10))


def test_update_allocation(client: TestClient, api: Api, setup: dict[str, dict[str, Any]]) -> None:
    allocation = api.allocation(setup["anna"]["id"], setup["gateway"]["id"])
    response = client.patch(
        f"{URL}/{allocation['id']}",
        json={"role": "QC Lead", "percent": 60, "comment": "Leads the release"},
    )
    assert response.status_code == 200
    body = response.json()
    assert (body["role"], body["percent"], body["comment"]) == ("QC Lead", 60, "Leads the release")


def test_update_cannot_change_engineer_or_project(
    client: TestClient, api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    allocation = api.allocation(setup["anna"]["id"], setup["gateway"]["id"])
    response = client.patch(
        f"{URL}/{allocation['id']}", json={"engineer_id": setup["maksym"]["id"]}
    )
    assert response.status_code == 422
    assert "engineer_id" in response.json()["error"]["fields"]


def test_update_validates_load_excluding_itself(
    client: TestClient, api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    first = api.allocation(setup["anna"]["id"], setup["gateway"]["id"], percent=50)
    api.allocation(setup["anna"]["id"], setup["portal"]["id"], percent=50)
    assert client.patch(f"{URL}/{first['id']}", json={"percent": 50}).status_code == 200
    assert client.patch(f"{URL}/{first['id']}", json={"percent": 51}).status_code == 422


def test_update_validates_combined_period(
    client: TestClient, api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    allocation = api.allocation(setup["anna"]["id"], setup["gateway"]["id"], start_date=day(5))
    response = client.patch(f"{URL}/{allocation['id']}", json={"end_date": day(4)})
    assert response.status_code == 422
    assert "end_date" in response.json()["error"]["fields"]


def test_end_active_allocation(
    client: TestClient, api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    allocation = api.allocation(setup["anna"]["id"], setup["gateway"]["id"], start_date=day(-10))
    response = client.post(f"{URL}/{allocation['id']}/end")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "ended"
    assert body["end_date"] == str(TODAY)
    assert body["ended_at"] is not None

    # Ended allocations are history: not editable, not endable, not on the dashboard.
    assert client.post(f"{URL}/{allocation['id']}/end").status_code == 409
    assert client.patch(f"{URL}/{allocation['id']}", json={"percent": 10}).status_code == 409
    dashboard = client.get("/api/v1/dashboard").json()
    assert dashboard["clusters"][0]["projects"][0]["allocations"] == []

    # The engineer can be allocated again (e.g. to another project) at full capacity.
    api.allocation(setup["anna"]["id"], setup["portal"]["id"], percent=100)


def test_end_planned_allocation_cancels_it(
    client: TestClient, api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    allocation = api.allocation(
        setup["anna"]["id"], setup["gateway"]["id"], start_date=day(4), end_date=day(95)
    )
    body = client.post(f"{URL}/{allocation['id']}/end").json()
    assert body["status"] == "ended"
    assert (body["start_date"], body["end_date"]) == (day(4), day(95))


def test_status_changes_over_time(
    client: TestClient, api: Api, clock: Clock, setup: dict[str, dict[str, Any]]
) -> None:
    allocation = api.allocation(
        setup["anna"]["id"], setup["gateway"]["id"], start_date=day(4), end_date=day(10)
    )

    def get() -> str:
        status: str = client.get(f"{URL}/{allocation['id']}").json()["status"]
        return status

    assert get() == "planned"
    clock.today = TODAY + timedelta(days=4)
    assert get() == "active"
    clock.today = TODAY + timedelta(days=10)
    assert get() == "active"  # end date is inclusive
    clock.today = TODAY + timedelta(days=11)
    assert get() == "ended"


def test_list_filters(client: TestClient, api: Api, setup: dict[str, dict[str, Any]]) -> None:
    active = api.allocation(setup["anna"]["id"], setup["gateway"]["id"], percent=50)
    planned = api.allocation(
        setup["anna"]["id"], setup["portal"]["id"], percent=50, start_date=day(3)
    )
    ended = api.allocation(setup["maksym"]["id"], setup["gateway"]["id"])
    client.post(f"{URL}/{ended['id']}/end")

    def ids(**params: Any) -> list[int]:
        return [a["id"] for a in client.get(URL, params=params).json()]

    assert ids() == [active["id"], planned["id"], ended["id"]]
    assert ids(status="active") == [active["id"]]
    assert ids(status=["active", "planned"]) == [active["id"], planned["id"]]
    assert ids(status="ended") == [ended["id"]]
    assert ids(engineer_id=setup["maksym"]["id"]) == [ended["id"]]
    assert ids(project_id=setup["portal"]["id"]) == [planned["id"]]
    assert client.get(URL, params={"status": "bogus"}).status_code == 422


def test_not_found(client: TestClient) -> None:
    assert client.get(f"{URL}/999").status_code == 404
    assert client.patch(f"{URL}/999", json={"percent": 5}).status_code == 404
    assert client.post(f"{URL}/999/end").status_code == 404


def test_allocations_cannot_be_deleted(
    client: TestClient, api: Api, setup: dict[str, dict[str, Any]]
) -> None:
    allocation = api.allocation(setup["anna"]["id"], setup["gateway"]["id"])
    assert client.delete(f"{URL}/{allocation['id']}").status_code == 405
