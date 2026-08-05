# Comprehensive Docker Guide

## Container Architecture Overview

The system runs 3 containerized microservices isolated within a shared bridge network (`enterprise_network`):

| Container Name | Technology Stack | Exposed Port | Purpose |
| :--- | :--- | :--- | :--- |
| `enterprise_frontend` | Node.js 20 Alpine / Next.js Standalone | `3000` | Server-Side Rendered UI |
| `enterprise_backend` | Python 3.12 Slim / Gunicorn + Uvicorn | `8000` | REST API Backend |
| `enterprise_proxy` | Nginx Alpine | `80`, `443` | Reverse Proxy & Load Balancer |

---

## 1. Frontend Docker Multi-Stage Strategy

The [`frontend/Dockerfile`](file:///workspaces/next_egg/frontend/Dockerfile) utilizes a 4-stage build:
1. `base`: Node.js 20 Alpine environment setup.
2. `deps`: Installs npm production dependencies with `npm ci`.
3. `builder`: Compiles Next.js standalone server build (`output: "standalone"`).
4. `runner`: Minified final image executing as non-root user `nextjs:nodejs` with `HEALTHCHECK`.

---

## 2. Backend Docker Multi-Stage Strategy

The [`backend/Dockerfile`](file:///workspaces/next_egg/backend/Dockerfile) utilizes a 2-stage build:
1. `builder`: Installs C-build dependencies and Python wheels into `/install`.
2. `runner`: Lean slim runner image equipped with Gunicorn worker manager (`-w 4`), `appuser:appgroup` non-root execution, `HEALTHCHECK`, and `UTF-8` locale settings.

---

## 3. Useful Docker Commands

### Development Mode:
```bash
# Build & start dev stack
docker compose up -d --build

# View real-time logs
docker compose logs -f

# Inspect health status
docker compose ps
```

### Production Mode:
```bash
# Start production stack
docker compose -f docker-compose.prod.yml up -d --build

# Stop production stack
docker compose -f docker-compose.prod.yml down
```
