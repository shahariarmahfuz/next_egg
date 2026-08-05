# Enterprise Business Management System (Single-Container Render Deployment)

A production-ready **Inventory, Sales, Purchase, Financial Accounting & Expense Management System** built with **Next.js 16 (App Router)** and **FastAPI (Python)**, packaged into a **single Docker container** for seamless deployment on **Render**.

---

## 1. Project Overview
The **Business Management System** provides centralized control over business operations:
- **Executive Dashboard**: Real-time business metrics calculated directly from database transactions.
- **Sales & Billing**: POS billing, item discounts, payment status tracking, and multi-format receipt printing (A4, A5, POS 80mm).
- **Purchases & Bills**: PO creation, stock auto-replenishment, and supplier balance tracking.
- **Expenses & Net Profit**: Categorized business expense vouchers feeding directly into net profit calculations.
- **Collections & Payments**: Debt collection and supplier payment vouchers with automatic ledger recalculations.
- **Returns Management**: Sale returns and product returns with automatic stock restoration.
- **Controlled Hard Delete**: Audit-compliant record purging protected by in-app text verification.
- **Role-Based Access Control (RBAC)**: Granular permission enforcement across 40+ capabilities.

---

## 2. Architecture & Single-Container Model
This project deploys as a **Single Render Web Service** running a **Single Docker Container**:
- **Next.js Frontend**: Listens publicly on Render's dynamic `$PORT`.
- **FastAPI Backend**: Listens **strictly internally** on `127.0.0.1:8000` (Never exposed publicly).
- **Internal Proxying**: Frontend communicates with FastAPI backend locally inside the container via Next.js rewrites (`/api/v1/*` $\rightarrow$ `http://127.0.0.1:8000/api/v1/*`).
- **Single Process Entrypoint**: `start.sh` runs Alembic database migrations, launches FastAPI in the background on `127.0.0.1:8000`, waits for health readiness, and launches Next.js standalone in the foreground on `$PORT`.

```
Render External Client (Browser)
             │ (Port $PORT)
             ▼
 ┌────────────────────────────────────────────────────────┐
 │ Single Docker Container (Render Web Service)           │
 │                                                        │
 │  Next.js Standalone Frontend (Port $PORT)              │
 │       │                                                │
 │       │ Rewrites /api/v1/*                             │
 │       ▼                                                │
 │  FastAPI Backend (127.0.0.1:8000 Internal Only)        │
 └───────│────────────────────────────────────────────────┘
         ▼
 Neon PostgreSQL Database (SSL)
```

---

## 3. Technology Stack
- **Frontend**: Next.js 16 (App Router, Standalone Output, TypeScript, Tailwind CSS, TanStack Query)
- **Backend**: FastAPI (Python 3.12, SQLAlchemy 2.0 Async ORM, Pydantic v2, Gunicorn, Uvicorn)
- **Database**: PostgreSQL (Neon Serverless PostgreSQL with SSL)
- **Containerization**: Multi-stage Dockerfile (`python:3.12-slim` + `node:20-alpine`)

---

## 4. Folder Structure
```
next_egg/
├── Dockerfile                # Single production Dockerfile (Project Root)
├── start.sh                  # Container entrypoint script (Migrations -> FastAPI -> Next.js)
├── .dockerignore             # Docker build exclusion rules
├── render.yaml               # Render Blueprint (Single Docker Web Service)
├── backend/                  # FastAPI Python Backend Source
│   ├── alembic/              # Database migration scripts
│   ├── app/                  # REST API endpoints, models, schemas & services
│   └── requirements.txt      # Python dependencies
├── frontend/                 # Next.js Frontend Application Source
│   ├── src/                  # App Router, UI components & API services
│   └── package.json          # Node dependencies & build scripts
├── PRODUCTION_CHECKLIST.md   # Deployment verification checklist
└── README.md                 # Project documentation
```

---

## 5. Required Environment Variables

Set these environment variables in your **Render Web Service**:

| Environment Variable | Description | Recommended / Example Value |
| :--- | :--- | :--- |
| `APP_NAME` | Application Title | `"Business Management System"` |
| `APP_ENV` | Environment Mode | `production` |
| `DEBUG` | Disable Swagger & Stack Traces in Prod | `false` |
| `API_V1_STR` | REST API Version Prefix | `/api/v1` |
| `SECRET_KEY` | 64-char JWT Signing Secret | Generate random hex string (`openssl rand -hex 32`) |
| `DATABASE_URL` | Neon PostgreSQL Connection URL | `postgresql+asyncpg://user:pass@ep-host.neon.tech/neondb?ssl=require` |
| `SERVER_API_URL` | Internal Container Backend URL | `http://127.0.0.1:8000/api/v1` |
| `NEXT_PUBLIC_API_URL` | Public Relative API Route Prefix | `/api/v1` |

---

## 6. GitHub Push Instructions

Push your latest codebase to GitHub before deploying on Render:

```bash
git add .
git commit -m "feat(deploy): convert to single-container production deployment for Render"
git push origin main
```

---

## 7. Render Deployment Instructions

### Option A: 1-Click Render Blueprint (Recommended)
1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\rightarrow$ **Blueprint**.
3. Connect your GitHub repository (`next_egg`).
4. Render automatically reads `render.yaml` and sets up the single Docker Web Service.
5. In the Render Dashboard, add your `DATABASE_URL` environment variable and click **Apply**.

### Option B: Manual Web Service Setup
1. In Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Select **Existing Image** or **Build and deploy from a Git repository**.
3. Connect your GitHub repository.
4. Set **Language / Runtime**: `Docker`.
5. Set **Dockerfile Path**: `Dockerfile` (Root).
6. Set **Docker Command**: Leave blank (Uses `CMD ["/app/start.sh"]` from Dockerfile).
7. Add Environment Variables (from Section 5 above).
8. Click **Create Web Service**.

---

## 8. Render Build & Start Workflow

Render builds and runs the single Docker container automatically:

### Multi-Stage Build Pipeline
1. **Stage 1 (Python Builder)**: Installs backend Python dependencies into a virtual environment.
2. **Stage 2 (Node Builder)**: Installs node packages and builds Next.js in `standalone` output mode.
3. **Stage 3 (Production Runner)**: Combines Python virtual environment, Node.js 20 runtime, FastAPI app code, Next.js standalone build, and `start.sh`.

### Automatic Container Startup Sequence (`start.sh`)
```bash
# 1. Runs database migrations automatically
python -m alembic upgrade head

# 2. Starts FastAPI backend internally (127.0.0.1:8000)
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 127.0.0.1:8000 --daemon

# 3. Starts Next.js standalone frontend publicly on Render $PORT
exec node server.js
```

---

## 9. Default Admin Account

When the backend starts for the first time, it automatically creates default roles, permissions, and the initial **System Owner** account:

- **Username**: `owner`
- **Email**: `owner@enterprise.com`
- **Default Password**: `Owner@123456`
- **Role**: `owner` (Full system access)

> [!IMPORTANT]
> Change the default owner password immediately after logging into your production instance!

---

## 10. Production & Security Notes
- **No Nginx or External Reverse Proxy**: Next.js standalone server handles static asset serving and internal proxying to FastAPI.
- **Port Isolation**: Port `8000` is strictly bound to `127.0.0.1` inside the container. Render exposes ONLY `$PORT` externally.
- **HTTPS & SSL**: Render automatically provides and manages SSL certificates for the public domain.
- **Automated Seeding & Migrations**: Schema migrations (`alembic upgrade head`) and RBAC seeding execute automatically during container boot.
