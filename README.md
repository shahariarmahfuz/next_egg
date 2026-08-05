# Enterprise Business Management System

A production-ready **Inventory, Sales, Purchase, Financial Accounting & Expense Management System** built for seamless deployment on **Render**.

---

## 1. Project Overview
The **Business Management System** provides centralized control over business operations:
- Real-time Executive KPI Dashboard (Sales, Cash/Due Sales, Purchases, Expenses, Customer/Supplier Dues, Net Profit).
- Product inventory catalog with stock tracking and reorder limits.
- Sales POS & Customer billing with printable vouchers (A4, A5, POS 80mm).
- Purchase management & supplier bill tracking.
- Expense tracking & voucher management.
- Customer debt collections & supplier payments with automatic ledger balance recalculation.
- Customer sale returns & supplier product returns with automatic stock restoration.
- Controlled Hard Delete safety system for permanent record removal.
- Role-Based Access Control (RBAC) with granular permissions.

---

## 2. Key Features
- **Executive Dashboard**: Real-time business metrics directly calculated from database transactions.
- **Sales & Purchases**: Multi-item transactions, automatic stock adjustment, and due tracking.
- **Expenses & Net Profit**: Categorized business expense management feeding directly into net profit calculations.
- **Voucher & Invoice Printing**: Multi-format printable receipts for sales, collections, payments, and returns.
- **Granular RBAC**: Flexible role & permission matrix for system users.

---

## 3. Technology Stack
- **Frontend**: Next.js 16 (App Router, TypeScript, Tailwind CSS, Radix UI, TanStack Query)
- **Backend**: FastAPI (Python 3.12, SQLAlchemy 2.0 Async ORM, Pydantic v2, Gunicorn, Uvicorn)
- **Database**: PostgreSQL (Neon Serverless PostgreSQL with SSL)

---

## 4. Folder Structure
```
next_egg/
├── backend/                  # FastAPI Python Backend
│   ├── alembic/              # Database migration files
│   ├── app/                  # REST API endpoints, models, schemas & services
│   ├── requirements.txt      # Python dependencies
│   └── alembic.ini           # Alembic configuration
├── frontend/                 # Next.js Frontend Application
│   ├── src/                  # App Router, UI components & API services
│   └── package.json          # Node dependencies & build scripts
├── render.yaml               # Render Blueprint Infrastructure Config
├── PRODUCTION_CHECKLIST.md   # Deployment verification checklist
└── README.md                 # Project documentation
```

---

## 5. Required Environment Variables

### Backend (`backend/.env`)
```ini
APP_NAME="Business Management API"
APP_ENV=production
DEBUG=false
API_V1_STR=/api/v1
SECRET_KEY=generate_a_secure_64_character_hex_string_using_openssl
ACCESS_TOKEN_EXPIRE_MINUTES=1440
REFRESH_TOKEN_EXPIRE_DAYS=7
DATABASE_URL=postgresql+asyncpg://user:password@ep-host.neon.tech/neondb?ssl=require
BACKEND_CORS_ORIGINS=["https://your-frontend-service.onrender.com"]
```

### Frontend (`frontend/.env.local`)
```ini
NEXT_PUBLIC_APP_NAME="Business Management System"
NEXT_PUBLIC_API_URL="https://your-backend-service.onrender.com/api/v1"
SERVER_API_URL="https://your-backend-service.onrender.com/api/v1"
```

---

## 6. GitHub Push Instructions

Before deploying on Render, push your latest code to your GitHub repository:

```bash
git add .
git commit -m "prepare project for render deployment"
git push origin main
```

---

## 7. Render Deployment Instructions

Deploying on Render takes only a few minutes:

### Option A: Render Blueprint (Automatic 1-Click Setup)
1. Log into your [Render Dashboard](https://dashboard.render.com).
2. Click **New +** $\rightarrow$ **Blueprint**.
3. Connect your GitHub repository (`next_egg`).
4. Render automatically reads `render.yaml` and sets up both Backend and Frontend web services.
5. In the Render Dashboard, add your `DATABASE_URL` environment variable under Backend settings and click **Apply**.

### Option B: Manual Web Service Setup

#### Backend Web Service
1. In Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Set **Root Directory**: `backend`
4. Set **Runtime**: `Python`
5. Configure **Build & Start Commands** (see sections 8 & 9 below).
6. Add Backend Environment Variables (section 10 below).

#### Frontend Web Service
1. In Render Dashboard, click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository.
3. Set **Root Directory**: `frontend`
4. Set **Runtime**: `Node`
5. Configure **Build & Start Commands** (see sections 8 & 9 below).
6. Add Frontend Environment Variables (section 10 below).

---

## 8. Render Build Commands

### Backend Web Service Build Command
```bash
pip install -r requirements.txt && python -m alembic upgrade head
```

### Frontend Web Service Build Command
```bash
npm install && npm run build
```

---

## 9. Render Start Commands

### Backend Web Service Start Command
```bash
gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker --bind 0.0.0.0:$PORT
```

### Frontend Web Service Start Command
```bash
npm start
```

---

## 10. Render Environment Variables Settings

### Backend Web Service
| Key | Value / Instructions |
| :--- | :--- |
| `APP_ENV` | `production` |
| `DEBUG` | `false` |
| `API_V1_STR` | `/api/v1` |
| `SECRET_KEY` | Generate a strong secret (or use Render's **Generate** button) |
| `DATABASE_URL` | Your Neon PostgreSQL connection string (`postgresql+asyncpg://...`) |
| `BACKEND_CORS_ORIGINS` | `["https://your-frontend-service.onrender.com"]` |

### Frontend Web Service
| Key | Value / Instructions |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `NEXT_PUBLIC_APP_NAME` | `"Business Management System"` |
| `NEXT_PUBLIC_API_URL` | `https://your-backend-service.onrender.com/api/v1` |
| `SERVER_API_URL` | `https://your-backend-service.onrender.com/api/v1` |

---

## 11. Database Migration Command (Render Build Step)

Database migrations run automatically during every Render build as part of the Backend Build Command:

```bash
python -m alembic upgrade head
```

This automatically upgrades your PostgreSQL schema to the latest version before the backend server starts.

---

## 12. Default Admin Account

When the backend service starts for the first time, it automatically creates system roles, permissions, and an initial **System Owner** account:

- **Username**: `owner`
- **Email**: `owner@enterprise.com`
- **Default Password**: `Owner@123456`
- **Role**: `owner` (Full system access)

> [!IMPORTANT]
> Log into the application and change the default password immediately after deployment!

---

## 13. Production Notes
- Render automatically manages SSL certificates (HTTPS) for both backend and frontend services.
- Hot reloads and automatic deployments trigger on every `git push origin main`.
- Automatic table creation and permission seeding run during application startup (`lifespan`).

---

## 14. Security Notes
- Never commit actual passwords or database connection strings to GitHub.
- Ensure `DEBUG=false` in Render Environment Variables.
- Restrict `BACKEND_CORS_ORIGINS` to your production frontend Render domain URL.
