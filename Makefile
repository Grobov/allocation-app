# Convenience commands. Backend uses uv (https://docs.astral.sh/uv/), frontend uses npm.
.PHONY: install migrate seed reset-db backend frontend dev test test-backend test-frontend \
        test-e2e lint typecheck build check

install:
	cd backend && uv sync
	cd frontend && npm ci

migrate:
	cd backend && uv run alembic upgrade head

seed:
	cd backend && uv run python -m app.seed

reset-db:
	cd backend && uv run alembic upgrade head && uv run python -m app.seed --reset

backend:
	cd backend && uv run uvicorn app.main:app --reload --port 8000

frontend:
	cd frontend && npm run dev

test: test-backend test-frontend

test-backend:
	cd backend && uv run pytest

test-frontend:
	cd frontend && npm test

test-e2e:
	cd frontend && npm run test:e2e

lint:
	cd backend && uv run ruff check . && uv run ruff format --check .
	cd frontend && npm run lint && npm run format:check

typecheck:
	cd backend && uv run mypy app tests migrations/env.py
	cd frontend && npm run typecheck

build:
	cd frontend && npm run build

check: lint typecheck test build
