"""Development/demo data mirroring the UI prototype.

Usage::

    python -m app.seed           # seed an empty database (no-op if data exists)
    python -m app.seed --reset   # wipe all data and seed again

Dates are relative to today so that "active" and "planned" states stay meaningful.
"""

import argparse
from datetime import UTC, date, datetime, timedelta

from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.db import build_engine, build_sessionmaker
from app.models import Allocation, AllocationRole, Cluster, Engineer, Project

ENGINEERS = [
    ("Anna Melnyk", "API automation focus"),
    ("Maksym Bondar", "Cross-project lead support"),
    ("Iryna Shevchenko", "Web UI and integrations"),
    ("Serhii Tkachenko", "Automation architect"),
    ("Kateryna Romanenko", "Data testing"),
    ("Andrii Koval", "Available for new project"),
    ("Olena Kovalenko", "QA Manager"),
    ("Dmytro Hrytsenko", "QA Manager"),
]

CLUSTERS = [
    ("Payments", "Olena Kovalenko"),
    ("Core Platform", "Dmytro Hrytsenko"),
    ("New Initiatives", None),  # empty cluster without a manager
]

PROJECTS = [
    ("Payment Gateway", "Core card payment processing", "Payments"),
    ("Merchant Portal", "Merchant administration application", "Payments"),
    ("Identity Service", "Authentication and account identity", "Core Platform"),
    ("Notification Service", "Email, SMS and push delivery", "Core Platform"),
    ("Data Platform", "Shared reporting and data pipelines", "Core Platform"),
]

# (engineer, project, role, percent, comment, start offset, end offset, explicitly ended)
ALLOCATIONS: list[tuple[str, str, AllocationRole, int, str, int, int | None, bool]] = [
    ("Anna Melnyk", "Payment Gateway", AllocationRole.QC, 100,
     "Backend and API testing. Owns regression scope.", -26, None, False),
    ("Maksym Bondar", "Payment Gateway", AllocationRole.QC_LEAD, 50,
     "Release coordination and test strategy.", -43, None, False),
    ("Iryna Shevchenko", "Merchant Portal", AllocationRole.QC, 75,
     "UI and integration testing.", -22, None, False),
    ("Maksym Bondar", "Merchant Portal", AllocationRole.QC, 25,
     "Supports release validation.", -7, None, False),
    ("Serhii Tkachenko", "Identity Service", AllocationRole.QC_LEAD, 100,
     "Automation and security-related quality scope.", -77, None, False),
    ("Kateryna Romanenko", "Data Platform", AllocationRole.QC, 50,
     "Planned allocation for analytics validation.", 4, 95, False),
    # History: an ended allocation (not shown on the dashboard, kept in the database).
    ("Andrii Koval", "Notification Service", AllocationRole.QC, 50,
     "Initial smoke test coverage.", -120, -30, True),
]  # fmt: skip


def reset(session: Session) -> None:
    for model in (Allocation, Project, Cluster, Engineer):
        session.execute(delete(model))
    session.commit()


def seed(session: Session, today: date) -> bool:
    """Insert demo data. Returns False (and does nothing) if the database is not empty."""
    if session.scalar(select(func.count(Engineer.id))):
        return False

    engineers = {name: Engineer(full_name=name, comment=comment) for name, comment in ENGINEERS}
    session.add_all(engineers.values())

    clusters = {
        name: Cluster(name=name, qa_manager=engineers[manager] if manager else None)
        for name, manager in CLUSTERS
    }
    session.add_all(clusters.values())

    projects = {
        name: Project(name=name, description=description, cluster=clusters[cluster])
        for name, description, cluster in PROJECTS
    }
    session.add_all(projects.values())

    for engineer, project, role, percent, comment, start, end, ended in ALLOCATIONS:
        end_date = today + timedelta(days=end) if end is not None else None
        session.add(
            Allocation(
                engineer=engineers[engineer],
                project=projects[project],
                role=role,
                percent=percent,
                comment=comment,
                start_date=today + timedelta(days=start),
                end_date=end_date,
                ended_at=datetime.combine(end_date, datetime.min.time(), UTC)
                if ended and end_date
                else None,
            )
        )
    session.commit()
    return True


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--reset", action="store_true", help="delete all data before seeding")
    args = parser.parse_args()

    settings = get_settings()
    engine = build_engine(settings.database_url)
    with build_sessionmaker(engine)() as session:
        if args.reset:
            reset(session)
        created = seed(session, settings.today())
    engine.dispose()
    print("Seed data created." if created else "Database already contains data; nothing seeded.")


if __name__ == "__main__":
    main()
