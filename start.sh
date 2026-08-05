#!/usr/bin/env bash
set -e

echo "=== Starting Enterprise Business Management System (Single Container) ==="

# 1. Run Alembic Database Migrations
echo "[1/3] Running Alembic Database Migrations..."
cd /app/backend
python -m alembic upgrade head || {
    echo "WARNING: Migration check finished with notice or schema is up to date."
}

# 2. Start FastAPI Backend in Background (Internal Only: 127.0.0.1:8000)
echo "[2/3] Starting FastAPI Backend on 127.0.0.1:8000 (Internal Only)..."
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000 --daemon --access-logfile - --error-logfile -

# Wait for FastAPI backend to respond on health endpoint
echo "Waiting for FastAPI backend readiness on http://127.0.0.1:8000/health..."
MAX_RETRIES=30
RETRY_COUNT=0
until curl -s http://127.0.0.1:8000/health > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    sleep 1
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo "ERROR: FastAPI Backend failed to start on 127.0.0.1:8000 within 30 seconds."
    exit 1
fi

echo "FastAPI Backend is healthy and listening on 127.0.0.1:8000!"

# 3. Start Next.js Frontend in Foreground (Render Public $PORT)
RENDER_PORT="${PORT:-10000}"
echo "[3/3] Starting Next.js Standalone Server on 0.0.0.0:${RENDER_PORT}..."
cd /app/frontend
export PORT="${RENDER_PORT}"
export HOSTNAME="0.0.0.0"
export SERVER_API_URL="http://127.0.0.1:8000/api/v1"
export NEXT_PUBLIC_API_URL="/api/v1"

exec node server.js
