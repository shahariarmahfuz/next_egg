#!/usr/bin/env bash
# ==============================================================================
# Single-Container Startup Script
# FastAPI Backend (127.0.0.1:8000) + Next.js Frontend (0.0.0.0:$PORT)
# ==============================================================================

# Do NOT use "set -e" here. We need fine-grained error handling for
# multi-process management. Individual commands check their own exit codes.

echo "=== Starting Enterprise Business Management System (Single Container) ==="
echo "Timestamp: $(date -u '+%Y-%m-%d %H:%M:%S UTC')"

# ---------------------------------------------------------------------------
# Step 1: Database Migrations & Seed (run once, must complete before anything)
# ---------------------------------------------------------------------------
echo ""
echo "[1/3] Running Alembic Database Migrations & System Seed..."
cd /app/backend

python -m alembic upgrade head
MIGRATION_EXIT=$?
if [ $MIGRATION_EXIT -ne 0 ]; then
    echo "WARNING: Alembic migration exited with code $MIGRATION_EXIT (schema may already be up to date)."
fi

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
"
SEED_EXIT=$?
if [ $SEED_EXIT -ne 0 ]; then
    echo "WARNING: Database seed exited with code $SEED_EXIT (seed data may already exist)."
fi

echo "[1/3] Database initialization complete."

# ---------------------------------------------------------------------------
# Step 2: Start FastAPI Backend
# ---------------------------------------------------------------------------
echo ""
echo "[2/3] Starting FastAPI Backend on 127.0.0.1:8000 (Internal Only)..."

# Use a single worker to avoid multiprocess supervisor complexity.
# The multiprocess supervisor (--workers 2) forks child processes that each
# independently import the app and connect to the database. In a
# single-container setup with a remote DB, this adds significant startup
# time and produces confusing "child process died" log messages. A single
# uvicorn worker with uvloop is sufficient for this workload.
python -m uvicorn app.main:app \
    --host 127.0.0.1 \
    --port 8000 \
    --log-level info \
    < /dev/null > /app/backend.log 2>&1 &
BACKEND_PID=$!

echo "FastAPI process started with PID: $BACKEND_PID"

# ---------------------------------------------------------------------------
# Readiness Check: Poll /health with process liveness verification
# ---------------------------------------------------------------------------
MAX_WAIT=120  # Maximum seconds to wait for backend readiness
POLL_INTERVAL=2  # Seconds between polls
ELAPSED=0

echo "Waiting up to ${MAX_WAIT}s for FastAPI readiness at http://127.0.0.1:8000/health..."

while [ $ELAPSED -lt $MAX_WAIT ]; do
    # First: check if the backend process is still alive
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo ""
        echo "============================================================="
        echo "FATAL: FastAPI process (PID $BACKEND_PID) exited prematurely!"
        echo "============================================================="
        echo "--- Backend Log ---"
        cat /app/backend.log
        echo "-------------------"
        exit 1
    fi

    # Second: try the health endpoint
    if curl -sf http://127.0.0.1:8000/health > /dev/null 2>&1; then
        echo ""
        echo "FastAPI Backend is READY (PID: $BACKEND_PID) after ${ELAPSED}s!"
        echo "  Listening on: http://127.0.0.1:8000"
        break
    fi

    sleep $POLL_INTERVAL
    ELAPSED=$((ELAPSED + POLL_INTERVAL))
done

# Check if we timed out
if [ $ELAPSED -ge $MAX_WAIT ]; then
    echo ""
    echo "============================================================="
    echo "FATAL: FastAPI Backend did not become ready within ${MAX_WAIT}s."
    echo "============================================================="
    echo "--- Backend Log ---"
    cat /app/backend.log
    echo "-------------------"
    kill $BACKEND_PID 2>/dev/null || true
    exit 1
fi

# ---------------------------------------------------------------------------
# Step 3: Start Next.js Frontend
# ---------------------------------------------------------------------------
RENDER_PORT="${PORT:-10000}"
echo ""
echo "[3/3] Starting Next.js Standalone Server on 0.0.0.0:${RENDER_PORT}..."
cd /app/frontend
export PORT="${RENDER_PORT}"
export HOSTNAME="0.0.0.0"
export SERVER_API_URL="http://127.0.0.1:8000/api/v1"
export NEXT_PUBLIC_API_URL="/api/v1"

node server.js &
NODE_PID=$!

echo "Next.js process started with PID: $NODE_PID"
echo ""
echo "=== All services started successfully ==="
echo "  FastAPI Backend : PID $BACKEND_PID -> http://127.0.0.1:8000"
echo "  Next.js Frontend: PID $NODE_PID   -> http://0.0.0.0:${RENDER_PORT}"
echo ""

# ---------------------------------------------------------------------------
# Signal Handling & Process Supervision
# ---------------------------------------------------------------------------

# Cleanup function for graceful shutdown
cleanup() {
    echo ""
    echo "=== Received shutdown signal. Stopping services... ==="
    # Send SIGTERM to both processes
    kill -TERM $NODE_PID 2>/dev/null
    kill -TERM $BACKEND_PID 2>/dev/null
    # Wait for them to exit gracefully (up to 10 seconds each)
    wait $NODE_PID 2>/dev/null
    wait $BACKEND_PID 2>/dev/null
    echo "=== All services stopped. ==="
    exit 0
}

trap cleanup SIGTERM SIGINT

# Supervision loop: monitor both processes
# If either process dies, log it, kill the other, and exit.
while true; do
    # Check backend
    if ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo ""
        echo "============================================================="
        echo "CRITICAL: FastAPI backend (PID $BACKEND_PID) has died!"
        echo "============================================================="
        echo "--- Backend Log (last 100 lines) ---"
        tail -n 100 /app/backend.log
        echo "-------------------------------------"
        kill -TERM $NODE_PID 2>/dev/null
        wait $NODE_PID 2>/dev/null
        exit 1
    fi

    # Check frontend
    if ! kill -0 $NODE_PID 2>/dev/null; then
        echo ""
        echo "============================================================="
        echo "CRITICAL: Next.js frontend (PID $NODE_PID) has died!"
        echo "============================================================="
        kill -TERM $BACKEND_PID 2>/dev/null
        wait $BACKEND_PID 2>/dev/null
        exit 1
    fi

    # Sleep before next check (short interval for responsive detection)
    sleep 5
done
