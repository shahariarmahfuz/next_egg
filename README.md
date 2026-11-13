# Next Egg — Poultry, Egg Trading & Enterprise Business Management System

A full-stack **Inventory, Sales, Purchases, Returns, Farm Production, Cash Book & Financial Accounting System** built with **Next.js 16 (App Router)** and **FastAPI (Async SQLAlchemy + PostgreSQL)**, packaged for **single-container production deployment on Render** as well as multi-service Docker Compose and local development.

---

## Table of Contents

1. [Core Features & Modules](#1-core-features--modules)
2. [Architecture & Single-Container Model](#2-architecture--single-container-model)
3. [Technology Stack](#3-technology-stack)
4. [Project Structure](#4-project-structure)
5. [Local Development Setup](#5-local-development-setup)
6. [Testing](#6-testing)
7. [Environment Variables](#7-environment-variables)
8. [Deployment (Render & Docker)](#8-deployment-render--docker)
9. [Default Seeded Accounts](#9-default-seeded-accounts)
10. [Additional Documentation](#10-additional-documentation)

---

## 1. Core Features & Modules

### Executive & Filtered Analytics
- **Main Dashboard (`/dashboard`) & Filtered Dashboard (`/dashboard/filtered`)**: Real-time sales, purchases, collections, expenses, customer/supplier dues, stock valuation, and **FIFO COGS & gross/net profit** over custom date ranges and business timezones.
- **System Status & Architecture Views (`/system-status`, `/architecture`, `/security`)**: Health diagnostics and operational visibility.

### Sales, Purchases & FIFO Inventory
- **Products & Inventory (`/products`)**: Multi-unit products, opening stock + opening unit cost, negative-stock-safe reporting, and **FIFO `InventoryBatch`** consumption tracking.
- **Sales (`/sales`, `/sales/new`, `/sales/reports`)**: Cash, partial, and due sales with unit-price or authoritative total-price modes, customer balance updates, invoice printing (A4/A5/POS), and **Sales Report** with gross vs. return/net revenue & units summary.
- **Purchases (`/purchases`, `/purchases/new`, `/purchases/reports`)**: Supplier billing, inventory batch creation, purchase editing with FIFO & ledger reconciliation, and purchase reporting.

### Returns Management (Mobile-Ready)
- **Sale Returns (`/sale-returns`, `/sale-returns/new`, `/sale-returns/reports`)**:
  - Returnable quantity lookup per invoice (`GET /api/v1/sale-returns/returnable-info/{sale_identifier}`).
  - Responsive **mobile card UI** alongside desktop table layout.
  - **Manual line return amount** override (`total_price`) in addition to automatic `quantity × unit_price` calculation.
  - Reverse-FIFO batch restoration, customer/invoice due adjustment, and optional **cash refund** (`refund_amount`) directly reflected in Cash Book & Sales Report.
- **Product / Purchase Returns (`/product-returns`, `/product-returns/new`, `/product-returns/reports`)**: Supplier return vouchers, stock reduction, and refund/payable adjustment.

### Cash Book, Cash Out & Bengali Print Statement
- **Daily Cash Book (`/cash/cash-book` & `/accounts/cash-book`)**:
  - Zero-opening independent daily cash ledger (`cash_sale`, `collection`, `expense`, `cash_out`, and `sale_return` cash refunds) using `Decimal` arithmetic.
- **Cash Out / Withdrawals (`/cash/cash-out`, `/accounts/cash-out`, `/reports/cash-out`)**: Standalone owner/cash withdrawal vouchers (`CO-...`) separate from business expenses.
- **A5 Printable Cash Book Statement (`DAILY SALES & CASH STATEMENT`)**:
  - Side-by-side **Stock Report** (`আগের স্টক`, `ক্রয়`, conditional **`ফেরত ডিম`** when returns exist, `নগদ বিক্রি`, `বাকি বিক্রি`, optional tracked customer row, and `অবশিষ্ট থাকবে` + manual `অবশিষ্ট আছে` check row) that preserves historical closing stock across dates.
  - Flexible customer **Print Merge Modes** (`normal`, `selected` merge, `all` merge) configured via `/settings/print`.
  - Supplier daily account summary (`previous_due`, `purchase_amount`, `return_amount`, `payment_amount`, `closing_due`) configured via `/settings/supplier-print`.

### Customers, Suppliers, Expenses & Ledgers
- **Customers (`/customers`, `/customers/dues`, `/customers/ledger`)** & **Collections (`/collections`, `/collections/reports`)**: Customer profiles, due tracking, running statements, and cash/non-cash receipts.
- **Suppliers (`/suppliers`, `/suppliers/dues`, `/suppliers/ledger`, `/suppliers/other-transaction`)** & **Supplier Payments (`/supplier-payments`, `/supplier-payments/reports`)**: Payables ledger, other payable transactions, and payment vouchers.
- **Balance Adjustments (`/api/v1/balance-adjustments`)**: Audited customer/supplier balance corrections preserving ledger continuity.
- **Expenses (`/expenses`, `/expenses/categories`, `/expenses/reports`)**: Categorized expense vouchers integrated into Cash Book, Cash Report, and Net Profit.

### Farm Management & Egg Calculator
- **Farm Operations (`/farm`, `/farm/production`, `/farm/delivery`, `/farm/ledger`, `/farm/report`)**: Poultry farm egg production tracking, deliveries, farm ledger, and farm reporting.
- **Egg Calculation Ledger (`/calculators`, `/calculators/egg`)**: Step-by-step arithmetic egg rate calculator with read-only live stock comparison and saved calculation history.

### Centralized Reporting & Settings
- **Reports Hub (`/reports`)**, **Daily Cash Report (`/reports/cash`)**, and **Daily Stock Report (`/reports/stock`)**: Printable end-of-day cash & product stock reconciliation reports.
- **Settings (`/settings`, `/settings/print`, `/settings/stock-report`, `/settings/supplier-print`)**: Business profile, timezone, multi-currency configuration (`/api/v1/currencies`), tracked stock-report customer, and print defaults.
- **RBAC, Users & Audit Logs (`/users`, `/roles`, `/profile`)**: Fine-grained role/permission enforcement across endpoints and UI routes, JWT access/refresh auth (`Remember Me`), activity logging, and verification-protected deletions.

---

## 2. Architecture & Single-Container Model

In production on Render, the project runs as a **Single Web Service** inside a **Single Docker Container** managed by `start.sh`:

- **Next.js Standalone Server**: Listens publicly on Render's `$PORT` (default `10000`) and proxies `/api/v1/*` requests internally.
- **FastAPI Backend**: Listens **strictly on `127.0.0.1:8000`** (internal only, never exposed publicly).
- **Startup Lifecycle (`start.sh`)**:
  1. Runs `python -m alembic upgrade head` and `Base.metadata.create_all` safety sync.
  2. Executes `seed_initial_data` (creates default RBAC roles/permissions, settings/currencies, and initial accounts if missing).
  3. Starts `uvicorn app.main:app --host 127.0.0.1 --port 8000` and polls `http://127.0.0.1:8000/health` until ready.
  4. Starts `node server.js` (Next.js standalone) on `0.0.0.0:$PORT` and supervises both processes.

```
Client Browser
      │  (HTTPS -> Container $PORT)
      ▼
┌──────────────────────────────────────────────────────────┐
│ Single Docker Container                                  │
│                                                          │
│  Next.js 16 Standalone Server (0.0.0.0:$PORT)            │
│       │                                                  │
│       │  Internal Proxy / Rewrites (/api/v1/*)           │
│       ▼                                                  │
│  FastAPI + Uvicorn (127.0.0.1:8000 Internal Only)        │
└───────│──────────────────────────────────────────────────┘
        │  asyncpg (SSL)
        ▼
PostgreSQL (Neon / Self-Hosted)
```

---

## 3. Technology Stack

- **Frontend**: Next.js `16.3.0` (App Router, Standalone output), React `19.2.8`, TypeScript `5`, Tailwind CSS `4`, TanStack Query `5`, React Hook Form + Zod, Zustand, Decimal.js, Lucide Icons
- **Backend**: Python `3.12`, FastAPI `>=0.115`, SQLAlchemy `>=2.0.35` (Async ORM), Pydantic v2, Alembic, `asyncpg` / `psycopg`, PyJWT, Passlib / Argon2
- **Database**: PostgreSQL (Neon Serverless PostgreSQL or local PostgreSQL)
- **Container & Proxy**: Multi-stage Docker (`python:3.12-slim` + `node:20-alpine`), plus optional `docker-compose.yml` with Nginx

---

## 4. Project Structure

```text
next_egg/
├── Dockerfile                  # Single-container multi-stage production build
├── start.sh                    # Migrations, seed, backend health wait & process supervision
├── render.yaml                 # Render Blueprint configuration
├── docker-compose.yml          # Multi-container development setup (backend + frontend + nginx)
├── docker-compose.prod.yml     # Multi-container production setup
├── .env.example                # Environment variable template
├── PRODUCTION_CHECKLIST.md     # Production verification checklist
├── backend/
│   ├── alembic/                # Alembic migrations
│   ├── app/
│   │   ├── api/v1/endpoints/   # REST API routers (sales, returns, cash book, farm, reports, etc.)
│   │   ├── core/               # Config, security, datetime & logging utilities
│   │   ├── db/                 # Session, Base, seed.py & seeds/
│   │   ├── models/             # SQLAlchemy models
│   │   ├── repositories/       # Data access & report aggregate queries
│   │   ├── schemas/            # Pydantic v2 request/response schemas
│   │   └── services/           # Business logic (FIFO, Cash Book, Returns, Reports, Farm)
│   ├── tests/                  # Pytest async integration & unit tests
│   └── requirements.txt
├── frontend/
│   ├── src/
│   │   ├── app/(dashboard)/    # App Router pages across all modules
│   │   ├── components/         # UI components, forms, modals & A5/A4/POS print templates
│   │   ├── providers/          # Auth, RBAC & React Query providers
│   │   ├── services/           # Typed API clients
│   │   ├── store/              # Zustand stores (auth, settings)
│   │   └── types/              # TypeScript interfaces
│   └── package.json
├── docs/                       # Architecture, backup/restore, Docker & deployment guides
├── nginx/                      # Nginx configuration for compose deployments
└── scripts/                    # Helper & tunnel scripts
```

---

## 5. Local Development Setup

### Prerequisites
- Python **3.12+**
- Node.js **20+** & `npm`
- PostgreSQL database URL (local PostgreSQL or Neon)

### 1. Configure Environment
Copy `.env.example` and populate `DATABASE_URL` and `SECRET_KEY`:

```bash
cp .env.example backend/.env
```

For local split-process development, set `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1` (or configure `frontend/.env.local`).

### 2. Run Backend (FastAPI)

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

# Run migrations and seed initial roles/users/settings
python -m alembic upgrade head
python -c "
import asyncio
from app.db.session import engine, AsyncSessionLocal
from app.db.base import Base
from app.db.seed import seed_initial_data
async def init():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    async with AsyncSessionLocal() as db:
        await seed_initial_data(db)
    await engine.dispose()
asyncio.run(init())
"

# Start API server on http://127.0.0.1:8000
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

### 3. Run Frontend (Next.js)

```bash
cd frontend
npm ci
npm run dev
```

Frontend runs at `http://localhost:3000`.

---

## 6. Testing

Backend tests live under `backend/tests/` (covering Cash Book invariants, Cash Out flow & RBAC, Daily Cash & Stock Reports, Report Filters, FIFO Profit Dashboard, Purchase Edit Reconciliation, Sale/Product Return & Hard Delete flows, Pricing Precision, and Remember Me auth):

```bash
cd backend
pytest
```

Frontend lint and production build verification:

```bash
cd frontend
npm run lint
npm run build
```

---

## 7. Environment Variables

| Variable | Description | Default / Example |
| :--- | :--- | :--- |
| `APP_NAME` | Backend API title | `"Business Management System"` |
| `APP_ENV` | Runtime mode (`development` / `production`) | `production` |
| `DEBUG` | Enables OpenAPI docs & debug details when `true` | `false` |
| `API_V1_STR` | API route prefix | `/api/v1` |
| `SECRET_KEY` | JWT signing secret (`openssl rand -hex 32`) | *(required in prod)* |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | Access token TTL (minutes) | `1440` |
| `REFRESH_TOKEN_EXPIRE_DAYS` | Refresh token TTL (days) | `7` |
| `DATABASE_URL` | PostgreSQL async URL (`postgresql+asyncpg://...`) | *(required)* |
| `BACKEND_CORS_ORIGINS` | Allowed CORS origins (JSON array or comma-separated) | `["http://localhost:3000"]` |
| `NEXT_PUBLIC_API_URL` | Client-side API base path | `/api/v1` |
| `SERVER_API_URL` | SSR/rewrite internal backend URL | `http://127.0.0.1:8000/api/v1` |
| `INITIAL_OWNER_PASSWORD` | Optional seed override for `owner` user | *(defaults in `seed.py`)* |
| `INITIAL_ADMIN_PASSWORD` | Optional seed override for `admin` user | *(defaults in `seed.py`)* |

---

## 8. Deployment (Render & Docker)

### Option A: Render 1-Click Blueprint (`render.yaml`)
1. Push your latest commits to GitHub (`git push origin main`).
2. In the [Render Dashboard](https://dashboard.render.com), choose **New + -> Blueprint** and connect the repository.
3. Render reads `render.yaml` (`env: docker`, `dockerfilePath: Dockerfile`, `region: singapore`), auto-generates `SECRET_KEY`, and prompts for `DATABASE_URL`.
4. Click **Apply**. `start.sh` automatically runs Alembic migrations, seeds initial data, starts FastAPI internally, and launches Next.js on `$PORT`.

### Option B: Manual Render Docker Web Service
1. Create a **Web Service** linked to this repository with **Runtime: Docker** and **Dockerfile Path: `Dockerfile`**.
2. Leave the start command blank so the container executes `CMD ["/app/start.sh"]`.
3. Add `DATABASE_URL`, `SECRET_KEY`, `APP_ENV=production`, `DEBUG=false`, `SERVER_API_URL=http://127.0.0.1:8000/api/v1`, and `NEXT_PUBLIC_API_URL=/api/v1`.

### Option C: Multi-Service Docker Compose
For separate `backend`, `frontend`, and `nginx` containers:

```bash
cp .env.example .env
# Populate DATABASE_URL and SECRET_KEY in .env
docker compose up --build -d
```

---

## 9. Default Seeded Accounts

On initial database initialization (`backend/app/db/seed.py`), the following accounts are created if they do not already exist:

| Role | Username | Email | Default Password (unless overridden via env) |
| :--- | :--- | :--- | :--- |
| `owner` | `owner` | `owner@enterprise.com` | `Owner@Argon2Secure2026!` *(or `INITIAL_OWNER_PASSWORD`)* |
| `admin` | `admin` | `admin@enterprise.com` | `Admin@Argon2Secure2026!` *(or `INITIAL_ADMIN_PASSWORD`)* |

> [!IMPORTANT]
> Set `INITIAL_OWNER_PASSWORD` / `INITIAL_ADMIN_PASSWORD` before first boot or change both passwords immediately after logging into production!

---

## 10. Additional Documentation

- [PRODUCTION_CHECKLIST.md](./PRODUCTION_CHECKLIST.md) — Pre-launch verification steps
- [docs/architecture.md](./docs/architecture.md) — System architecture overview
- [docs/deployment_guide.md](./docs/deployment_guide.md) & [docs/production_startup_guide.md](./docs/production_startup_guide.md) — Deployment and startup details
- [docs/backup_and_restore_guide.md](./docs/backup_and_restore_guide.md) — Database backup and recovery procedures
