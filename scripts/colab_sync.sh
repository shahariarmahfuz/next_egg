#!/usr/bin/env bash
set -e

SESSION_NAME="${COLAB_SESSION:-next-egg}"
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ARCHIVE_PATH="/tmp/egg_sync.tar.gz"

echo "==> Packaging local codebase from ${PROJECT_ROOT}..."
tar --exclude='.git' \
    --exclude='node_modules' \
    --exclude='.next' \
    --exclude='__pycache__' \
    --exclude='.pytest_cache' \
    --exclude='.venv' \
    --exclude='*.pyc' \
    --exclude='.DS_Store' \
    -czf "${ARCHIVE_PATH}" \
    -C "${PROJECT_ROOT}" .

echo "==> Uploading archive to Colab session '${SESSION_NAME}'..."
colab upload -s "${SESSION_NAME}" "${ARCHIVE_PATH}" /content/egg_sync.tar.gz

echo "==> Extracting files on remote Colab VM (/content/egg)..."
printf "!mkdir -p /content/egg && tar -xzf /content/egg_sync.tar.gz -C /content/egg && rm -f /content/egg_sync.tar.gz\n" | colab exec -s "${SESSION_NAME}" --timeout 60 > /dev/null

echo "==> Sync complete! Remote codebase is up-to-date."
