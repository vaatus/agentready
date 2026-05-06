# AgentReady — application image (CPU; the MI300X-bound LLM serving is a
# separate container, see docs/AKASH_DEPLOY.md). Built off slim-bookworm so
# it's small enough to land cheaply on Akash providers.

FROM python:3.11-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_SYSTEM_PYTHON=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY pyproject.toml ./
RUN pip install --upgrade pip && pip install -e ".[dev]" && pip install aiosqlite

COPY apps ./apps
COPY agents ./agents
COPY owasp_asi ./owasp_asi
COPY chaos ./chaos
COPY verification ./verification
COPY digital_twins ./digital_twins
COPY leaderboard ./leaderboard

RUN mkdir -p /data && chown -R 1000:1000 /data

EXPOSE 8000
CMD ["uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
