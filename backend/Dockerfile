# syntax=docker/dockerfile:1

FROM python:3.12-slim AS builder

WORKDIR /app

ENV PATH="/app/.venv/bin:$PATH"

ARG PIP_INDEX_URL=https://mirrors.aliyun.com/pypi/simple/

COPY requirements.txt ./
RUN python -m venv .venv \
    && pip install --no-cache-dir --index-url ${PIP_INDEX_URL} -r requirements.txt

COPY alembic.ini ./
COPY app ./app
COPY scripts ./scripts

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
