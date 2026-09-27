"""Helpers shared by the service modules."""

from datetime import UTC, date, datetime
from typing import Any, TypeVar

from sqlalchemy import func, select
from sqlalchemy.orm import InstrumentedAttribute, Session

from app.errors import ConflictError, DomainValidationError, NotFoundError
from app.models import Cluster, Engineer, Project

LiveModel = TypeVar("LiveModel", Engineer, Cluster, Project)


def utcnow() -> datetime:
    return datetime.now(UTC)


def format_date(value: date) -> str:
    return value.strftime("%d %b %Y")


def get_live_or_404(session: Session, model: type[LiveModel], entity_id: int) -> LiveModel:
    entity = session.get(model, entity_id)
    if entity is None or entity.deleted_at is not None:
        raise NotFoundError(f"{_label(model)} {entity_id} was not found.")
    return entity


def get_live_reference(
    session: Session, model: type[LiveModel], entity_id: int, field: str
) -> LiveModel:
    """Resolve an id referenced from a request body; unknown ids are a validation error."""
    entity = session.get(model, entity_id)
    if entity is None or entity.deleted_at is not None:
        message = f"{_label(model)} {entity_id} does not exist."
        raise DomainValidationError(message, fields={field: message})
    return entity


def ensure_unique_name(
    session: Session,
    model: type[LiveModel],
    column: InstrumentedAttribute[Any],
    value: str,
    *,
    field: str,
    exclude_id: int | None = None,
) -> None:
    query = select(model.id).where(func.lower(column) == value.lower(), model.deleted_at.is_(None))
    if exclude_id is not None:
        query = query.where(model.id != exclude_id)
    if session.scalar(query.limit(1)) is not None:
        message = f"{_label(model)} named “{value}” already exists."
        raise ConflictError(message, fields={field: message})


def _label(model: type[Any]) -> str:
    return {Engineer: "Engineer", Cluster: "Cluster", Project: "Project"}.get(model, model.__name__)
