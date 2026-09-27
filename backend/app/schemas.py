"""Pydantic request/response models for the REST API."""

import enum
from datetime import date, datetime
from typing import Annotated, Any, ClassVar, Self

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator

from app.models import COMMENT_MAX_LENGTH, NAME_MAX_LENGTH, AllocationRole

Name = Annotated[
    str, StringConstraints(strip_whitespace=True, min_length=1, max_length=NAME_MAX_LENGTH)
]
Comment = Annotated[str, StringConstraints(strip_whitespace=True, max_length=COMMENT_MAX_LENGTH)]
Percent = Annotated[int, Field(ge=1, le=100, description="Share of working time, 1-100.")]
Id = Annotated[int, Field(gt=0)]


class AllocationStatus(enum.StrEnum):
    PLANNED = "planned"
    ACTIVE = "active"
    ENDED = "ended"


class EngineerStatus(enum.StrEnum):
    ALLOCATED = "allocated"
    PLANNED = "planned"
    UNALLOCATED = "unallocated"
    MANAGER = "manager"


class InputModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class PatchModel(InputModel):
    """Partial update: omitted fields are left unchanged.

    Fields listed in ``non_nullable`` may be omitted but must not be explicitly ``null``.
    """

    non_nullable: ClassVar[frozenset[str]] = frozenset()

    @model_validator(mode="before")
    @classmethod
    def _reject_nulls(cls, data: Any) -> Any:
        if isinstance(data, dict):
            nulls = sorted(k for k in cls.non_nullable if k in data and data[k] is None)
            if nulls:
                raise ValueError(f"Field(s) cannot be null: {', '.join(nulls)}")
        return data

    def changes(self) -> dict[str, Any]:
        return self.model_dump(exclude_unset=True)


class ReadModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)


# --- References (compact embedded objects) ---------------------------------------------


class EngineerRef(ReadModel):
    id: int
    full_name: str


class ClusterRef(ReadModel):
    id: int
    name: str


class ProjectRef(ReadModel):
    id: int
    name: str
    cluster_id: int


# --- Engineers -----------------------------------------------------------------------------


class EngineerCreate(InputModel):
    full_name: Name
    comment: Comment = ""


class EngineerUpdate(PatchModel):
    non_nullable = frozenset({"full_name", "comment"})

    full_name: Name | None = None
    comment: Comment | None = None


class EngineerRead(ReadModel):
    id: int
    full_name: str
    comment: str
    created_at: datetime
    updated_at: datetime


# --- Clusters ------------------------------------------------------------------------------


class ClusterCreate(InputModel):
    name: Name
    qa_manager_id: Id | None = Field(
        default=None, description="Engineer who is the QA Manager of the cluster."
    )


class ClusterUpdate(PatchModel):
    non_nullable = frozenset({"name"})

    name: Name | None = None
    qa_manager_id: Id | None = None


class ClusterRead(ReadModel):
    id: int
    name: str
    qa_manager_id: int | None
    qa_manager: EngineerRef | None
    created_at: datetime
    updated_at: datetime


# --- Projects ------------------------------------------------------------------------------


class ProjectCreate(InputModel):
    name: Name
    description: Comment = ""
    cluster_id: Id


class ProjectUpdate(PatchModel):
    non_nullable = frozenset({"name", "description", "cluster_id"})

    name: Name | None = None
    description: Comment | None = None
    cluster_id: Id | None = Field(
        default=None, description="Changing the cluster moves the project to that cluster."
    )


class ProjectRead(ReadModel):
    id: int
    name: str
    description: str
    cluster_id: int
    cluster: ClusterRef
    created_at: datetime
    updated_at: datetime


# --- Allocations ---------------------------------------------------------------------------


class _AllocationPeriodCheck(BaseModel):
    @model_validator(mode="after")
    def _check_period(self) -> Self:
        start: date | None = getattr(self, "start_date", None)
        end: date | None = getattr(self, "end_date", None)
        if start is not None and end is not None and end < start:
            raise ValueError("End date cannot be before the start date.")
        return self


class AllocationCreate(InputModel, _AllocationPeriodCheck):
    engineer_id: Id
    project_id: Id
    role: AllocationRole = AllocationRole.QC
    percent: Percent = 100
    comment: Comment = ""
    start_date: date | None = Field(default=None, description="Defaults to today.")
    end_date: date | None = Field(default=None, description="Inclusive; null = open-ended.")


class AllocationUpdate(PatchModel, _AllocationPeriodCheck):
    """Engineer and project of an allocation are fixed once created."""

    non_nullable = frozenset({"role", "percent", "comment", "start_date"})

    role: AllocationRole | None = None
    percent: Percent | None = None
    comment: Comment | None = None
    start_date: date | None = None
    end_date: date | None = None


class AllocationRead(ReadModel):
    id: int
    engineer_id: int
    project_id: int
    engineer: EngineerRef
    project: ProjectRef
    role: AllocationRole
    percent: int
    comment: str
    start_date: date
    end_date: date | None
    ended_at: datetime | None
    status: AllocationStatus
    created_at: datetime
    updated_at: datetime


# --- Read views ------------------------------------------------------------------------------


class DashboardAllocation(BaseModel):
    id: int
    engineer: EngineerRef
    role: AllocationRole
    percent: int
    comment: str
    start_date: date
    end_date: date | None
    status: AllocationStatus


class DashboardProject(BaseModel):
    id: int
    name: str
    description: str
    cluster_id: int
    allocations: list[DashboardAllocation]


class DashboardCluster(BaseModel):
    id: int
    name: str
    qa_manager: EngineerRef | None
    projects: list[DashboardProject]


class DashboardSummary(BaseModel):
    clusters: int
    projects: int
    engineers: int
    unallocated_engineers: int = Field(
        description="Engineers with no active or planned allocation who manage no cluster."
    )


class Dashboard(BaseModel):
    today: date
    summary: DashboardSummary
    clusters: list[DashboardCluster]


class EngineerOverviewAllocation(BaseModel):
    id: int
    project: ProjectRef
    role: AllocationRole
    percent: int
    start_date: date
    end_date: date | None
    status: AllocationStatus


class EngineerOverview(BaseModel):
    id: int
    full_name: str
    comment: str
    allocations: list[EngineerOverviewAllocation] = Field(
        description="Current (active and planned) allocations."
    )
    managed_clusters: list[ClusterRef]
    total_percent: int = Field(
        description="Peak combined allocation percentage from today onwards."
    )
    status: EngineerStatus


class Health(BaseModel):
    status: str
    database: str
