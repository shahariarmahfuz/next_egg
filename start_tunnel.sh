#!/usr/bin/env bash

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=== 1. Starting Backend (FastAPI on 127.0.0.1:8000) ==="
cd "$DIR/backend"
"$DIR/backend/.venv/bin/python" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --log-level info > "$DIR/backend.log" 2>&1 &
BACKEND_PID=$!
echo "Backend PID: $BACKEND_PID"

cleanup() {
    echo "Shutting down services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true
}
trap cleanup SIGINT SIGTERM EXIT

echo "Waiting for Backend to become ready..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:8000/health > /dev/null 2>&1; then
        echo "Backend is READY on http://127.0.0.1:8000"
        break
    fi
    sleep 1
done

echo "=== 2. Starting Frontend (Next.js on 0.0.0.0:3000) ==="
cd "$DIR/frontend"
cp -r "$DIR/frontend/public" "$DIR/frontend/.next/standalone/" 2>/dev/null || true
cp -r "$DIR/frontend/.next/static" "$DIR/frontend/.next/standalone/.next/" 2>/dev/null || true
PORT=3000 HOSTNAME=0.0.0.0 node "$DIR/frontend/.next/standalone/server.js" > "$DIR/frontend.log" 2>&1 &
FRONTEND_PID=$!
echo "Frontend PID: $FRONTEND_PID"

echo "Waiting for Frontend to become ready..."
for i in {1..30}; do
    if curl -s http://127.0.0.1:3000 > /dev/null 2>&1; then
        echo "Frontend is READY on http://127.0.0.1:3000"
        break
    fi
    sleep 1
done

echo "=== 3. Starting Cloudflare Quick Tunnel for Frontend (http://127.0.0.1:3000) ==="
cloudflared tunnel --url http://127.0.0.1:3000
