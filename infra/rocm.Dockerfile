# AgentReady — application image (CPU; the MI300X-bound LLM serving is a
# separate container, see docs/AKASH_DEPLOY.md). Built off slim-bookworm so
# it's small enough to land cheaply on Akash providers.

FROM python:3.11-slim-bookworm AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    UV_SYSTEM_PYTHON=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    git curl ca-certificates gnupg && \
    install -dm 755 /etc/apt/keyrings && \
    curl -fsSL https://cli.github.com/packages/githubcli-archive-keyring.gpg | tee /etc/apt/keyrings/githubcli-archive-keyring.gpg > /dev/null && \
    chmod go+r /etc/apt/keyrings/githubcli-archive-keyring.gpg && \
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/githubcli-archive-keyring.gpg] https://cli.github.com/packages stable main" > /etc/apt/sources.list.d/github-cli.list && \
    apt-get update && apt-get install -y --no-install-recommends gh && \
    rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy source first so the editable install can find the package layout.
COPY pyproject.toml README.md LICENSE ./
COPY apps ./apps
COPY agents ./agents
COPY owasp_asi ./owasp_asi
COPY chaos ./chaos
COPY verification ./verification
COPY digital_twins ./digital_twins
COPY leaderboard ./leaderboard

RUN pip install --upgrade pip && pip install -e ".[dev]" && pip install aiosqlite

RUN mkdir -p /data && chown -R 1000:1000 /data

EXPOSE 8000
CMD ["uvicorn", "apps.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
