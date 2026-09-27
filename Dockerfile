# syntax=docker/dockerfile:1

# --- Frontend build -----------------------------------------------------------------------
FROM node:22-alpine AS frontend
WORKDIR /frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# --- Backend runtime ----------------------------------------------------------------------
FROM python:3.12-slim AS runtime
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PROJECT_ENVIRONMENT=/opt/venv \
    PATH="/opt/venv/bin:$PATH"
RUN pip install --no-cache-dir "uv>=0.8,<0.9"

WORKDIR /app
COPY backend/pyproject.toml backend/uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY backend/ ./
RUN uv sync --frozen --no-dev
COPY --from=frontend /frontend/dist /app/static

RUN useradd --system --uid 1000 app && chown -R app /app
USER app

ENV FRONTEND_DIST=/app/static
EXPOSE 8000
# Apply migrations, optionally load demo data, then serve API + frontend.
CMD ["sh", "-c", "alembic upgrade head && if [ \"$SEED_DEMO_DATA\" = \"true\" ]; then python -m app.seed; fi && exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers"]
