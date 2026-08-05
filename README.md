# Business Management System (Production-Ready)

A modern, enterprise-grade **Inventory, Sales, Purchase, Financial Accounting & Expense Management System** built with **Next.js 16 (App Router, TypeScript, Tailwind CSS)** and **FastAPI (Python, SQLAlchemy 2.0 Async ORM, PostgreSQL)**.

---

## Table of Contents
- [Project Overview](#project-overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Folder Structure](#folder-structure)
- [Prerequisites](#prerequisites)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Database Configuration & Migrations](#database-configuration--migrations)
- [Build & Run Commands](#build--run-commands)
- [Production Deployment Guide](#production-deployment-guide)
  - [Deploying to Render (Blueprint / Manual)](#deploying-to-render)
  - [Docker / Nginx Deployment](#docker--nginx-deployment)
- [Default Admin Account](#default-admin-account)
- [Troubleshooting & FAQs](#troubleshooting--faqs)
- [Backup Recommendation](#backup-recommendation)
- [Security Notes](#security-notes)
- [License](#license)

---

## Project Overview
The **Business Management System** provides real-time visibility and complete transactional control over business operations:
- **Executive Dashboard**: Real-time KPI metrics for Total Sales, Cash Sales, Due Sales, Purchases, Expenses, Customer Dues, Supplier Dues, and Net Profit.
- **Inventory & Catalog Management**: Real-time stock level tracking, barcode generation, reorder thresholds, unit prices, and product categories.
- **Sales & Billing (POS)**: Customer invoice creation, multi-item discount calculations, payment status management (Paid, Partial, Unpaid), stock deductions, customer ledger integration, and printable invoices (A4, A5, POS 80mm).
- **Purchases & Supplier Dues**: Purchase order creation, supplier bill management, stock auto-replenishment, and supplier balance tracking.
- **Expense Module**: Expense category management, voucher creation, payment method filters, and automatic integration into net profit calculations.
- **Customer Collections & Supplier Payments**: Debt collection and supplier payment vouchers with automatic ledger balance recalculations.
- **Returns Management**: Customer sale returns and supplier product returns with automatic stock and due balance adjustments.
- **Controlled Hard Delete System**: Audit-compliant cascading record purge protected by in-app modal verification requiring explicit `DELETE` confirmation.
- **Role-Based Access Control (RBAC)**: Granular permission enforcement across 40+ system capabilities.

---

## Technology Stack

### Frontend
- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack)
- **Language**: TypeScript 5
- **Styling**: Tailwind CSS 4, Radix UI Primitives, Lucide Icons
- **State & Data Fetching**: TanStack React Query v5, Axios
- **Notifications**: Sonner

### Backend
- **Framework**: [FastAPI](https://fastapi.tiangolo.com/) (Python 3.12)
- **ASGI Server**: Uvicorn & Gunicorn
- **ORM & Database**: SQLAlchemy 2.0 (Async Engine) + Alembic Migrations
- **Database**: PostgreSQL (Neon Serverless PostgreSQL with SSL)
- **Security**: PyJWT (HS256), Passlib (Bcrypt hashing)

---

## Folder Structure

```
next_egg/
├── backend/                  # FastAPI Python Backend Service
│   ├── alembic/              # Database migration scripts
│   ├── app/
│   │   ├── api/v1/           # REST API endpoints (v1)
│   │   ├── core/             # Application settings, security, logging
│   │   ├── db/               # Session management & initial data seeder
│   │   ├── exceptions/       # Custom exception classes & global handlers
│   │   ├── middlewares/      # Logging, CORS, GZip middlewares
│   │   ├── models/           # SQLAlchemy Declarative Models
│   │   ├── repositories/     # Data Access Layer (Repository pattern)
│   │   ├── schemas/          # Pydantic v2 Validation Schemas
│   │   └── services/         # Business Logic Layer
│   ├── requirements.txt      # Production Python dependencies
│   └── alembic.ini           # Alembic migration configuration
├── frontend/                 # Next.js React Frontend Application
│   ├── src/
│   │   ├── app/              # Next.js App Router (Dashboard & Manage Pages)
│   │   ├── components/       # UI Components & Modals (HardDeleteModal, Dialogs)
│   │   ├── hooks/            # Custom React hooks (e.g. useDebounce)
│   │   ├── providers/        # Auth & Permission Providers
│   │   ├── services/         # API Client Services
│   │   ├── types/            # TypeScript interfaces & types
│   │   └── utils/            # Currency, Date, and Export Formatters
│   ├── package.json          # Frontend Node dependencies & scripts
│   └── next.config.ts        # Next.js configuration
├── render.yaml               # Render Infrastructure-as-Code Blueprint
├── PRODUCTION_CHECKLIST.md   # Deployment verification checklist
├── .env.example              # Production environment variable reference
└── README.md                 # Complete system documentation
```

---

## Prerequisites
- **Node.js**: `v20.x` or higher
- **npm**: `v10.x` or higher
- **Python**: `v3.12.x` or higher
- **PostgreSQL**: `v15.x` or higher (or a cloud PostgreSQL instance like [Neon.tech](https://neon.tech))

---

## Local Development Setup

### 1. Repository Setup
```bash
git clone https://github.com/shahariarmahfuz/next_egg.git
cd next_egg
```

### 2. Backend Setup
```bash
# Navigate to backend directory
cd backend

# Create & activate Python virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env from template
cp .env.example .env

# Run database migrations
python -m alembic upgrade head

# Start FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```
The backend API will be available at `http://localhost:8000`. Interactive API documentation is accessible at `http://localhost:8000/api/v1/docs`.

### 3. Frontend Setup
```bash
# In a new terminal, navigate to frontend directory
cd frontend

# Install Node dependencies
npm install

# Create .env.local from template
cp .env.example .env.local

# Start Next.js development server
npm run dev
```
The frontend application will be available at `http://localhost:3000`.

---

## Environment Variables

### Backend Environment Variables (`backend/.env`)
| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `APP_NAME` | Name of the backend API service | `"Business Management API"` |
| `APP_ENV` | Environment mode (`development` / `production`) | `production` |
| `DEBUG` | Enable detailed logs and swagger docs | `false` |
| `API_V1_STR` | REST API version prefix | `/api/v1` |
| `SECRET_KEY` | 64-char JWT signing secret (`openssl rand -hex 32`) | `a8f9c2...` |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | JWT access token validity in minutes | `1440` (24 Hours) |
| `REFRESH_TOKEN_EXPIRE_DAYS` | JWT refresh token validity in days | `7` |
| `DATABASE_URL` | Neon PostgreSQL async connection string | `postgresql+asyncpg://user:pass@ep-host.neon.tech/neondb?ssl=require` |
| `BACKEND_CORS_ORIGINS` | Allowed CORS frontend origins (JSON array format) | `["https://your-frontend-app.onrender.com"]` |

### Frontend Environment Variables (`frontend/.env.local`)
| Variable | Description | Example Value |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_NAME` | Application title shown in UI | `"Business Management System"` |
| `NEXT_PUBLIC_API_URL` | Public REST API base URL accessed by browser | `"https://your-backend-api.onrender.com/api/v1"` |
| `SERVER_API_URL` | Internal API base URL accessed by Next.js SSR | `"https://your-backend-api.onrender.com/api/v1"` |

---

## Database Configuration & Migrations

The system uses **SQLAlchemy 2.0 Async ORM** with **Alembic** for schema migrations.

### Common Database Commands

```bash
cd backend
source venv/bin/activate

# Check current migration revision
python -m alembic current

# Upgrade database schema to head
python -m alembic upgrade head

# Rollback last migration revision
python -m alembic downgrade -1

# Create a new migration revision after model changes
python -m alembic revision --autogenerate -m "describe_schema_changes"
```

---

## Build & Run Commands

### Frontend Production Build
```bash
cd frontend
npm run build   # Compiles TypeScript and creates optimized production build
npm start       # Launches Next.js production server on http://localhost:3000
```

### Backend Production Server
```bash
cd backend
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:8000
```

---

## Production Deployment Guide

### Deploying to Render

You can deploy the entire stack to [Render](https://render.com) using the included `render.yaml` Blueprint or manually creating Web Services.

#### Option A: Render Blueprint Deployment (Recommended)
1. Push your repository to GitHub / GitLab.
2. Log into your **Render Dashboard**.
3. Click **New +** $\rightarrow$ **Blueprint**.
4. Connect your GitHub repository. Render will automatically read `render.yaml` and configure both services:
   - `business-management-backend` (Python Web Service)
   - `business-management-frontend` (Node Web Service)
5. Add your PostgreSQL `DATABASE_URL` under the Backend environment settings.
6. Click **Apply**. Render will automatically run build commands, migrations, and start both services!

#### Option B: Manual Render Deployment

##### 1. Deploy Backend Web Service
- **Environment**: Python
- **Root Directory**: `backend`
- **Build Command**: `pip install -r requirements.txt && python -m alembic upgrade head`
- **Start Command**: `gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT`
- **Environment Variables**: Set `APP_ENV=production`, `DEBUG=false`, `SECRET_KEY`, `DATABASE_URL`, and `BACKEND_CORS_ORIGINS`.

##### 2. Deploy Frontend Web Service
- **Environment**: Node
- **Root Directory**: `frontend`
- **Build Command**: `npm install && npm run build`
- **Start Command**: `npm start`
- **Environment Variables**: Set `NODE_ENV=production`, `NEXT_PUBLIC_API_URL` (your Render backend URL + `/api/v1`).

---

## Default Admin Account

When the backend server starts for the first time, it automatically creates system roles, permissions, and an initial **System Owner** account:

- **Username**: `owner`
- **Email**: `owner@enterprise.com`
- **Default Password**: `Owner@123456`
- **Role**: `owner` (Full unrestricted permissions)

> [!IMPORTANT]
> Change the default owner password immediately after logging into production!

---

## Troubleshooting & FAQs

### 1. Database Connection Error (`asyncpg.exceptions` or SSL Error)
- Ensure your `DATABASE_URL` starts with `postgresql+asyncpg://` or `postgresql://`. The system validator will automatically convert `postgres://` or `postgresql://` to `postgresql+asyncpg://` and convert `sslmode=require` to `ssl=require`.

### 2. CORS Policy Blocked Error on Frontend
- Check `BACKEND_CORS_ORIGINS` in your backend environment variables. Ensure it matches your frontend domain exactly (e.g. `["https://your-app.onrender.com"]`).

### 3. Next.js Static Page Build Errors
- Run `npm run build` locally in `frontend/` to view exact TypeScript or linting output before pushing to production.

---

## Backup Recommendation

### Database Automated Backups (Neon PostgreSQL)
1. **Point-In-Time Recovery (PITR)**: Enable PITR on your Neon PostgreSQL dashboard to allow restoring the database to any millisecond within your retention window.
2. **Scheduled Logical Backups (`pg_dump`)**:
   ```bash
   pg_dump "postgresql://user:password@ep-host.neon.tech/neondb" -F c -b -v -f enterprise_backup_$(date +%Y%m%d).dump
   ```
3. **Restoring from Dump**:
   ```bash
   pg_restore -d "postgresql://user:password@ep-host.neon.tech/neondb" --clean enterprise_backup_YYYYMMDD.dump
   ```

---

## Security Notes
- **Secrets Management**: Never commit `.env` or secrets to source control. `.gitignore` is pre-configured to ignore all environment files.
- **Passwords**: All passwords are hashed using `passlib` with `bcrypt`.
- **JWT Protection**: Tokens are signed using `HS256` with strict expiration windows.

---

## License
This project is licensed under the MIT License - see the `LICENSE` file for details.
