"""Database engine / session factory helpers."""

from collections.abc import Iterator
from typing import Any

from fastapi import Request
from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker


def build_engine(database_url: str, *, echo: bool = False) -> Engine:
    connect_args: dict[str, Any] = {}
    is_sqlite = database_url.startswith("sqlite")
    if is_sqlite:
        connect_args["check_same_thread"] = False

    engine = create_engine(
        database_url, echo=echo, pool_pre_ping=not is_sqlite, connect_args=connect_args
    )

    if is_sqlite:

        @event.listens_for(engine, "connect")
        def _enable_sqlite_foreign_keys(dbapi_connection: Any, _record: Any) -> None:
            # SQLite does not enforce foreign keys unless explicitly enabled per connection.
            cursor = dbapi_connection.cursor()
            cursor.execute("PRAGMA foreign_keys=ON")
            cursor.close()

    return engine


def build_sessionmaker(engine: Engine) -> sessionmaker[Session]:
    return sessionmaker(bind=engine, expire_on_commit=False, autoflush=False)


def get_session(request: Request) -> Iterator[Session]:
    """FastAPI dependency: one session (and transaction scope) per request."""
    factory: sessionmaker[Session] = request.app.state.sessionmaker
    with factory() as session:
        try:
            yield session
        except Exception:
            session.rollback()
            raise
