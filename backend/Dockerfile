# syntax=docker/dockerfile:1

FROM ghcr.io/astral-sh/uv:0.11.32 AS uv

FROM python:3.12-slim AS builder

COPY --from=uv /uv /uvx /bin/

WORKDIR /app

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy

COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project

COPY alembic.ini ./
COPY app ./app
COPY scripts ./scripts
RUN uv sync --frozen --no-dev

FROM python:3.12-slim AS runtime

RUN groupadd --system --gid 10001 beiyu \
    && useradd --system --uid 10001 --gid beiyu --create-home beiyu

WORKDIR /app

ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY --from=builder --chown=beiyu:beiyu /app /app

USER beiyu

EXPOSE 8000

CMD ["fastapi", "run", "app/main.py", "--host", "0.0.0.0", "--port", "8000"]
