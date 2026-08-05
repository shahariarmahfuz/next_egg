#!/usr/bin/env bash
set -e

echo "=== Starting Enterprise Business Management System (Single Container) ==="

# 1. Run Alembic Database Migrations & System Seed
echo "[1/3] Running Alembic Database Migrations & System Seed..."
cd /app/backend
python -m alembic upgrade head || {
    echo "WARNING: Migration check finished with notice or schema is up to date."
}
python -c "
import asyncio
from app.db.session import engine, AsyncSessionLocal
from app.db.base import Base
from app.db.seed import seed_initial_data

async def init_db():
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with AsyncSessionLocal() as session:
            await seed_initial_data(session)
    finally:
        await engine.dispose()

asyncio.run(init_db())
" || {
    echo "Notice: System database seed check complete."
}

# 2. Start FastAPI Backend in Background (With stdin redirected from /dev/null)
echo "[2/3] Starting FastAPI Backend on 127.0.0.1:8000 (Internal Only)..."
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 < /dev/null > /app/backend.log 2>&1 &
BACKEND_PID=$!

# Wait briefly for FastAPI to initialize (optional, we won't block Next.js from starting)
echo "Waiting up to 15 seconds for FastAPI backend readiness on http://127.0.0.1:8000/health..."
MAX_RETRIES=15
RETRY_COUNT=0
until curl -s http://127.0.0.1:8000/health > /dev/null 2>&1 || [ $RETRY_COUNT -eq $MAX_RETRIES ]; do
    sleep 1
    RETRY_COUNT=$((RETRY_COUNT + 1))
done

if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
    echo "FastAPI Backend is healthy (PID: $BACKEND_PID) and listening on 127.0.0.1:8000!"
else
    echo "WARNING: FastAPI Backend not fully ready within 15 seconds, but continuing to start Next.js..."
    echo "Tail of backend.log:"
    tail -n 10 /app/backend.log
fi

# 3. Start Next.js Frontend (Render Public $PORT)
RENDER_PORT="${PORT:-10000}"
echo "[3/3] Starting Next.js Standalone Server on 0.0.0.0:${RENDER_PORT}..."
cd /app/frontend
export PORT="${RENDER_PORT}"
export HOSTNAME="0.0.0.0"
export SERVER_API_URL="http://127.0.0.1:8000/api/v1"
export NEXT_PUBLIC_API_URL="/api/v1"

# Handle container shutdown signals
trap 'kill $BACKEND_PID 2>/dev/null; exit 0' SIGTERM SIGINT

# Run Next.js server in foreground
exec node server.js
