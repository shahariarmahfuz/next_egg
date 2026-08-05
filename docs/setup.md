# Setup & Installation Guide

## System Prerequisites

- **Node.js**: v20.0.0+ or v24+
- **Python**: v3.11+ or v3.12+
- **Docker & Docker Compose**: Docker Engine 24.0+
- **Git**

## Quick Start (Local Development)

### 1. Backend Setup

```bash
cd backend

# Create Python virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy environment variables
cp .env.example .env

# Run database migrations
alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --reload --port 8000
```

The FastAPI REST API interactive documentation will be available at:
- **Swagger UI**: http://localhost:8000/api/v1/docs
- **Health Ping**: http://localhost:8000/health

### 2. Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Run Next.js development server
npm run dev
```

The Next.js Web Application will be available at:
- **Web App**: http://localhost:3000

## Verifying Setup

1. Open http://localhost:3000 in your browser.
2. The System Architecture Dashboard will display the **System Ready & Connected** badge.
3. The Live Backend Telemetry widget will display operational status from `http://localhost:8000/api/v1/health`.
