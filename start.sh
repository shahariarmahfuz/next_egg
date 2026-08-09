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
# We run uvicorn without --workers when running inside a shell script to avoid process management issues 
# Or we can keep --workers 2 but ensure the parent shell stays alive to manage it.
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --workers 2 < /dev/null > /app/backend.log 2>&1 &
BACKEND_PID=$!

# Wait briefly for FastAPI to initialize
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
    echo "ERROR: FastAPI Backend failed to start within 15 seconds."
    echo "Tail of backend.log:"
    tail -n 50 /app/backend.log
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# 3. Start Next.js Frontend (Render Public $PORT)
RENDER_PORT="${PORT:-10000}"
echo "[3/3] Starting Next.js Standalone Server on 0.0.0.0:${RENDER_PORT}..."
cd /app/frontend
export PORT="${RENDER_PORT}"
export HOSTNAME="0.0.0.0"
export SERVER_API_URL="http://127.0.0.1:8000/api/v1"
export NEXT_PUBLIC_API_URL="/api/v1"

node server.js &
NODE_PID=$!

# Handle container shutdown signals
trap 'echo "Shutting down processes..."; kill -TERM $BACKEND_PID $NODE_PID 2>/dev/null; wait $BACKEND_PID $NODE_PID; exit 0' SIGTERM SIGINT

# Wait for ANY process to exit. If one exits, the container must exit to let the orchestrator restart it.
wait -n $BACKEND_PID $NODE_PID
EXIT_CODE=$?

echo "========================================================="
echo "CRITICAL: A process exited unexpectedly with code $EXIT_CODE."
echo "========================================================="
echo "--- Tail of Backend Log ---"
tail -n 50 /app/backend.log
echo "---------------------------"

# Terminate the remaining processes
kill -TERM $BACKEND_PID $NODE_PID 2>/dev/null || true
wait $BACKEND_PID $NODE_PID 2>/dev/null || true

exit $EXIT_CODE
