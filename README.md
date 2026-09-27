# QA Allocation Manager

A web application for managing QA clusters, projects, engineers and their project allocations.
It is a full implementation of the "QA Allocation Manager" HTML prototype, backed by a REST API
and a relational database.

- **Allocation Dashboard** – summary metrics, cluster tabs, project cards with the engineers
  allocated to each project, and create/edit/delete flows for clusters, projects and allocations.
- **Engineers** – people managed independently from projects, with their current allocations,
  total load and status (Allocated / Planned / Unallocated / Manager).

## Tech stack

| Layer    | Choice                                                                                 |
| -------- | -------------------------------------------------------------------------------------- |
| Backend  | Python 3.11+, **FastAPI**, **SQLAlchemy 2** (ORM), **Pydantic v2**, **Alembic**, uv    |
| Database | **PostgreSQL 16** (recommended) or SQLite (zero-setup local development)               |
| Frontend | **React 19** + **TypeScript**, Vite, TanStack Query, React Router                      |
| Quality  | pytest, Ruff, mypy (strict) · Vitest + Testing Library, oxlint, Prettier · Playwright + axe-core |

## Quick start

### Option A – Docker (PostgreSQL, single command)

```bash
cp .env.example .env            # set POSTGRES_PASSWORD
docker compose up --build
```

Open http://localhost:8000 (API docs: http://localhost:8000/api/docs). Migrations run
automatically on start; demo data is loaded when the database is empty (`SEED_DEMO_DATA=true`).

### Option B – Local development

Prerequisites: Python ≥ 3.11 with [uv](https://docs.astral.sh/uv/), Node.js ≥ 20.19.

```bash
# Backend (terminal 1) — SQLite by default, see backend/.env.example for PostgreSQL
cd backend
uv sync
uv run alembic upgrade head        # create/upgrade the schema
uv run python -m app.seed          # demo data (use --reset to wipe and re-seed)
uv run uvicorn app.main:app --reload --port 8000

# Frontend (terminal 2) — dev server proxies /api to http://127.0.0.1:8000
cd frontend
npm ci
npm run dev
```

Open http://localhost:5173. Equivalent `make` targets exist (`make install migrate seed`,
`make backend`, `make frontend`, `make check`).

To use PostgreSQL locally, set `DATABASE_URL` (e.g. in `backend/.env`):

```
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/qa_allocation
```

To serve the built frontend from the API process (production-like, one port):

```bash
cd frontend && npm run build
cd ../backend && FRONTEND_DIST=../frontend/dist uv run uvicorn app.main:app --port 8000
```

### Configuration (backend environment variables)

| Variable        | Default                               | Purpose                                             |
| --------------- | ------------------------------------- | --------------------------------------------------- |
| `DATABASE_URL`  | `sqlite:///backend/qa_allocation.db`  | SQLAlchemy URL (`postgresql+psycopg://…` for PG)    |
| `CORS_ORIGINS`  | `http://localhost:5173,…`             | Comma-separated browser origins allowed to call API |
| `TIMEZONE`      | server local time                     | IANA zone that defines "today" (e.g. `Europe/Kyiv`) |
| `FRONTEND_DIST` | –                                     | Serve the built SPA from this directory             |

## Architecture

```
frontend/ (React SPA)  ──HTTP/JSON──▶  backend/ (FastAPI)  ──SQLAlchemy──▶  PostgreSQL / SQLite
```

**Backend** (`backend/app`) is layered:

- `api/routes/*` – thin HTTP layer: routing, status codes, OpenAPI docs.
- `schemas.py` – Pydantic request/response models (validation, trimming, `extra="forbid"`).
- `services/*` – business rules and transactions (one commit per use case).
- `models.py` – SQLAlchemy ORM models; `migrations/` – Alembic migrations.
- `errors.py` – domain exceptions mapped to a single JSON error format.
- `seed.py` – demo data; `config.py` – settings from environment variables.

**Frontend** (`frontend/src`) is organised by feature:

- `api/` – typed fetch client (`ApiError` with field errors), TanStack Query hooks.
- `features/dashboard|clusters|projects|engineers|allocations` – pages and dialogs.
- `components/` – accessible building blocks: `Modal` (native `<dialog>`), `Menu`
  (WAI-ARIA menu button), `ConfirmDialog`, `Field`.
- After any mutation all queries are invalidated so dashboard and engineers views stay consistent.
- The selected cluster tab is kept in the URL (`/?cluster=2`), so views are linkable.

## Database design

```mermaid
erDiagram
    ENGINEERS ||--o{ ALLOCATIONS : "is allocated"
    PROJECTS  ||--o{ ALLOCATIONS : "has"
    CLUSTERS  ||--o{ PROJECTS : "contains"
    ENGINEERS |o--o{ CLUSTERS : "QA manager of"

    ENGINEERS {
        int id PK
        varchar full_name "unique (case-insensitive) among non-deleted"
        text comment "general, person-level comment"
        timestamptz deleted_at "soft delete"
    }
    CLUSTERS {
        int id PK
        varchar name "unique (case-insensitive) among non-deleted"
        int qa_manager_id FK "nullable, ON DELETE SET NULL"
        timestamptz deleted_at
    }
    PROJECTS {
        int id PK
        varchar name "unique (case-insensitive) among non-deleted"
        text description
        int cluster_id FK "NOT NULL, ON DELETE RESTRICT"
        timestamptz deleted_at
    }
    ALLOCATIONS {
        int id PK
        int engineer_id FK "ON DELETE RESTRICT"
        int project_id FK "ON DELETE RESTRICT"
        varchar role "CHECK in ('QC','QC Lead')"
        smallint percent "CHECK 1..100"
        text comment "project-specific comment"
        date start_date
        date end_date "inclusive, NULL = open-ended; CHECK >= start_date"
        timestamptz ended_at "set by 'End allocation'"
    }
```

All tables also have `created_at` / `updated_at`.

Key decisions:

- **Engineers exist independently.** An engineer ↔ project relationship is the `allocations`
  association table carrying allocation-specific data (role, percent, comment, period), so an
  engineer can be allocated to several projects and a project can have many engineers.
- **QA Manager** is a nullable FK from `clusters` to `engineers` – any engineer may manage a cluster.
- **History is preserved.** Allocations are never deleted: "End allocation" sets `ended_at`
  (and `end_date = today` for an active allocation; a planned one is cancelled). Engineers,
  clusters and projects are *soft-deleted* (`deleted_at`) so historical allocations keep valid
  references. Name uniqueness uses **partial unique indexes** on `lower(name)` covering only
  non-deleted rows, so names can be reused after deletion.
- **Safe deletion** (enforced by the service layer, backed by `RESTRICT` FKs):
  a cluster can only be deleted when it has no projects; a project or engineer only when they
  have no current (active/planned) allocations. Deleting an engineer who manages clusters
  unassigns them (the UI warns about this).
- **Status is derived, not stored:** `planned` (start date after today), `active`, or `ended`
  (explicitly ended, or end date in the past). Dashboard and totals show active + planned.
- **Integrity rules:** an engineer cannot have two overlapping current allocations on the same
  project (409), and their combined allocation may not exceed **100% on any day** (422).
- Indexes: FK columns (`clusters.qa_manager_id`, `projects.cluster_id`) and composite
  `(engineer_id, ended_at)` / `(project_id, ended_at)` for current-allocation lookups.
- The schema is created only via Alembic (`migrations/versions/…_0001_initial_schema.py`);
  `alembic check` reports no drift on PostgreSQL and SQLite.

## REST API

Base path `/api/v1`. Interactive documentation: **`/api/docs`** (Swagger UI), `/api/redoc`,
schema at `/api/openapi.json`.

| Method & path                         | Description                                                         |
| ------------------------------------- | ------------------------------------------------------------------- |
| `GET /dashboard`                      | Clusters → projects → current allocations + summary metrics         |
| `GET /clusters` · `POST /clusters`    | List / create clusters                                              |
| `GET·PATCH·DELETE /clusters/{id}`     | Read / update (name, `qa_manager_id`) / delete (409 if has projects) |
| `GET /projects[?cluster_id=]` · `POST /projects` | List / create projects                                   |
| `GET·PATCH·DELETE /projects/{id}`     | `PATCH cluster_id` moves the project; delete 409 if allocated       |
| `GET /engineers` · `POST /engineers`  | List / create engineers                                             |
| `GET /engineers/overview`             | Engineers with current allocations, total %, status, managed clusters |
| `GET·PATCH·DELETE /engineers/{id}`    | Read / update / delete (409 if allocated; unassigns managed clusters) |
| `GET /allocations[?engineer_id=&project_id=&status=]` | List allocations incl. history (status: planned/active/ended) |
| `POST /allocations`                   | Allocate an engineer to a project                                   |
| `GET·PATCH /allocations/{id}`         | Read / update role, percent, comment, dates (engineer & project fixed) |
| `POST /allocations/{id}/end`          | End an allocation (kept as history)                                 |
| `GET /health`                         | Liveness + database check                                           |

Status codes: `200`, `201` (created), `204` (deleted), `404`, `409` (conflict: duplicate name,
blocked deletion, overlapping allocation, editing ended allocation), `422` (validation).
Errors share one shape:

```json
{ "error": { "code": "validation_error", "message": "…", "fields": { "percent": "…" } } }
```

Example:

```bash
curl -X POST localhost:8000/api/v1/allocations -H 'Content-Type: application/json' \
  -d '{"engineer_id": 6, "project_id": 4, "role": "QC", "percent": 50, "comment": "Smoke tests"}'
```

## Testing & quality checks

```bash
cd backend
uv run ruff check . && uv run ruff format --check .
uv run mypy app tests migrations/env.py
uv run pytest                                   # SQLite
TEST_DATABASE_URL=postgresql+psycopg://…/qa_test uv run pytest   # PostgreSQL

cd frontend
npm run lint && npm run format:check && npm run typecheck
npm test                                        # Vitest component/unit tests
npm run build
npm run test:e2e                                # Playwright: real backend + browser
E2E_DATABASE_URL=postgresql+psycopg://…/qa_test npm run test:e2e
```

- **Backend tests** (pytest) exercise the API end-to-end through the real Alembic migrations:
  CRUD for every entity, validation and error format, uniqueness, safe deletion, allocation
  overlap/over-allocation rules, status over time, dashboard/overview aggregation, migration
  up/down, SPA serving.
- **Frontend tests** (Vitest + Testing Library) cover create vs. edit dialog behaviour
  (disabled/read-only fields), tab keyboard navigation, empty states, server error display.
- **E2E tests** (Playwright) run the prototype workflows in Chromium against the real stack
  and include automated WCAG 2.1 AA checks with axe-core.
- CI (`.github/workflows/ci.yml`) runs all of the above, backend tests on both databases.

## Demo data

`python -m app.seed` creates the prototype's data: clusters *Payments*, *Core Platform* and
the empty *New Initiatives* (no QA manager), five projects (one without engineers), eight
engineers including an engineer on two projects, a planned allocation, an unallocated
engineer, two QA managers, and one ended allocation kept as history. Dates are relative to
today so active/planned states stay meaningful.

## Notes & limitations

- **No authentication/authorization** yet (by design). Add an identity provider (e.g. OIDC/SSO)
  and role checks before exposing the app beyond a trusted network.
- The allocation dialog adds **Start date / End date** fields to the prototype's form so that
  planned allocations (shown in the prototype) can actually be created; start defaults to today.
- "Total" on the Engineers page is the engineer's **peak combined allocation from today on**
  (so sequential allocations are not summed).
- Allocation history is available through the API (`GET /allocations?status=ended`); the UI
  shows current allocations only, like the prototype.
- List endpoints are not paginated (data volumes for this domain are small).
- Concurrent edits use last-write-wins; name uniqueness is also guarded by database indexes.
