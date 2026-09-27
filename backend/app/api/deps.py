"""Shared FastAPI dependencies."""

from datetime import date
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.orm import Session

from app.db import get_session


def get_today(request: Request) -> date:
    """'Today' as seen by the domain rules (overridable in tests)."""
    today: date = request.app.state.today_provider()
    return today


SessionDep = Annotated[Session, Depends(get_session)]
TodayDep = Annotated[date, Depends(get_today)]
