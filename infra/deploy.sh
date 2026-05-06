#!/usr/bin/env bash
# Build + push image and create an Akash deployment.
# Requires: AKASH_KEY_NAME, AKASH_NODE in env. Run from repo root.
set -euo pipefail

IMAGE="${IMAGE:-ghcr.io/vaatus/agentready:latest}"
SDL="${SDL:-infra/akash-deploy.yaml}"

echo "→ build image $IMAGE"
docker build -t "$IMAGE" -f infra/rocm.Dockerfile .
docker push "$IMAGE"

echo "→ create akash deployment from $SDL"
provider-services tx deployment create "$SDL" \
  --from "$AKASH_KEY_NAME" \
  --node "$AKASH_NODE" \
  --keyring-backend "${AKASH_KEYRING_BACKEND:-os}" \
  --gas auto --gas-adjustment 1.4 \
  --yes

echo "→ done. List active leases with:"
echo "  provider-services query market lease list --owner \$(provider-services keys show $AKASH_KEY_NAME -a) --node \$AKASH_NODE"
