# ==============================================================================
# SINGLE-CONTAINER PRODUCTION DOCKERFILE FOR RENDER
# FastApi Backend (127.0.0.1:8000 Internal) + Next.js Standalone Frontend ($PORT Public)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Build Python Virtual Environment
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS python-builder

WORKDIR /build/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

RUN python -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# ------------------------------------------------------------------------------
# Stage 2: Build Next.js Frontend Standalone
# ------------------------------------------------------------------------------
FROM node:20-alpine AS node-builder

WORKDIR /build/frontend

ENV NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL="/api/v1" \
    SERVER_API_URL="http://127.0.0.1:8000/api/v1"

# Copy package locks & install production dependencies
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci

# Copy frontend source and build standalone server
COPY frontend/ ./
RUN npm run build

# ------------------------------------------------------------------------------
# Stage 3: Production Single Container Runner
# ------------------------------------------------------------------------------
FROM python:3.12-slim AS runner

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app/backend \
    PATH="/opt/venv/bin:$PATH" \
    NODE_ENV=production \
    SERVER_API_URL="http://127.0.0.1:8000/api/v1" \
    NEXT_PUBLIC_API_URL="/api/v1" \
    LANG=C.UTF-8 \
    LC_ALL=C.UTF-8 \
    TZ=UTC

# Install Node.js 20 & Curl in Python runner base image
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    ca-certificates \
    gnupg \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_20.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt-get update && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

# Copy Python virtual environment from python-builder
COPY --from=python-builder /opt/venv /opt/venv

# Copy FastAPI backend application code & Alembic scripts
COPY backend /app/backend

# Copy Next.js standalone build & static assets from node-builder
COPY --from=node-builder /build/frontend/public /app/frontend/public
COPY --from=node-builder /build/frontend/.next/standalone /app/frontend/
COPY --from=node-builder /build/frontend/.next/static /app/frontend/.next/static

# Copy single startup script
COPY start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Expose Render PORT (Only public entry port, default 10000)
EXPOSE 10000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://127.0.0.1:8000/health || exit 1

CMD ["/app/start.sh"]
