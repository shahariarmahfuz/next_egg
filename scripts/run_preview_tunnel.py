import subprocess
import time
import re
import os
import sys

print("=== Cleaning up existing processes on ports 8000 & 3000 ===")
os.system("pkill -9 -f 'uvicorn app.main:app' 2>/dev/null || true")
os.system("pkill -9 -f 'server.js' 2>/dev/null || true")
os.system("pkill -9 -f 'next-server' 2>/dev/null || true")
os.system("pkill -9 -f 'cloudflared tunnel' 2>/dev/null || true")
os.system("fuser -k 8000/tcp 2>/dev/null || true")
os.system("fuser -k 3000/tcp 2>/dev/null || true")
time.sleep(2)

print("=== Starting Backend (FastAPI on :8000) ===")
backend_log = open("/content/backend.log", "w")
backend_proc = subprocess.Popen(
    ["python3", "-m", "uvicorn", "app.main:app", "--host", "127.0.0.1", "--port", "8000"],
    cwd="/content/egg/backend",
    stdout=backend_log,
    stderr=backend_log,
    start_new_session=True,
)
print(f"Backend started (PID: {backend_proc.pid})")

# Wait for backend health
print("Checking backend health...")
for _ in range(15):
    time.sleep(1)
    res = os.system("curl -s http://127.0.0.1:8000/api/v1/health > /dev/null")
    if res == 0:
        print("Backend is healthy!")
        break

print("=== Preparing and Starting Frontend (Next.js on :3000) ===")
# Ensure static and public folders are correctly copied into standalone directory
os.system("mkdir -p /content/egg/frontend/.next/standalone/.next")
os.system("rm -rf /content/egg/frontend/.next/standalone/.next/static")
os.system("cp -r /content/egg/frontend/.next/static /content/egg/frontend/.next/standalone/.next/")
os.system("rm -rf /content/egg/frontend/.next/standalone/public")
os.system("cp -r /content/egg/frontend/public /content/egg/frontend/.next/standalone/")

frontend_log = open("/content/frontend.log", "w")
env = os.environ.copy()
env["PORT"] = "3000"
env["HOSTNAME"] = "0.0.0.0"
env["NODE_ENV"] = "production"

frontend_proc = subprocess.Popen(
    ["node", "server.js"],
    cwd="/content/egg/frontend/.next/standalone",
    stdout=frontend_log,
    stderr=frontend_log,
    env=env,
    start_new_session=True,
)
print(f"Frontend started (PID: {frontend_proc.pid})")

print("Checking frontend health...")
for _ in range(15):
    time.sleep(1)
    res = os.system("curl -s http://127.0.0.1:3000 > /dev/null")
    if res == 0:
        print("Frontend is healthy!")
        break

print("=== Starting Cloudflare Quick Tunnel for port 3000 ===")
os.system("rm -f /content/tunnel.log")
tunnel_log = open("/content/tunnel.log", "w")
tunnel_proc = subprocess.Popen(
    ["cloudflared", "tunnel", "--url", "http://127.0.0.1:3000"],
    stdout=tunnel_log,
    stderr=tunnel_log,
    start_new_session=True,
)
print(f"Cloudflared started (PID: {tunnel_proc.pid})")

tunnel_url = None
for i in range(30):
    time.sleep(1)
    if os.path.exists("/content/tunnel.log"):
        with open("/content/tunnel.log") as f:
            content = f.read()
            match = re.search(r"https://[a-zA-Z0-9-]+\.trycloudflare\.com", content)
            if match:
                tunnel_url = match.group(0)
                break

if tunnel_url:
    print("\n" + "=" * 60)
    print(f"🚀 CLOUDFLARE TUNNEL URL: {tunnel_url}")
    print("=" * 60 + "\n")
else:
    print("Could not find tunnel URL yet. Last log output:")
    if os.path.exists("/content/tunnel.log"):
        with open("/content/tunnel.log") as f:
            print(f.read()[-500:])
