# Docker & Deployment Guide

## Overview

The application is containerized using **multi-stage Docker builds** for minimum container footprint, fast build caching, and production security compliance.

## Environment Containers

- **`enterprise_frontend`**: Next.js 16+ Node.js 20 Alpine standalone image running on port 3000.
- **`enterprise_backend`**: FastAPI Python 3.12-slim image running Gunicorn with Uvicorn workers on port 8000.
- **`enterprise_proxy`**: Nginx Alpine reverse proxy running on port 80.

## Development Container Commands

To build and start all containers in development mode with live volume mounts:

```bash
# Start containers in background
docker compose up -d --build

# View container logs
docker compose logs -f

# Check container status
docker compose ps

# Stop containers
docker compose down
```

## Production Deployment

To run production-hardened containers with resource limits and restart policies:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

## Nginx Reverse Proxy Configuration

Nginx routes traffic seamlessly across frontend and backend services:

- `http://localhost/` -> Proxied to `frontend:3000`
- `http://localhost/api/` -> Proxied to `backend:8000/api/`
- `http://localhost/health` -> Proxied to `backend:8000/health`
