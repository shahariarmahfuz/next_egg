# Production Release Checklist

Use this verification checklist prior to launching the Business Management System in production on Render or cloud hosting environments.

---

## 1. Build & Compilation Verification
- [x] **Next.js Production Build**: `npm run build` in `frontend/` compiles cleanly with 0 TypeScript and Turbopack errors across all 52 static and dynamic routes.
- [x] **Python Application Compilation**: FastAPI backend compiles without syntax or indentation errors.
- [x] **Production WSGI/ASGI Server**: Backend boots cleanly under Gunicorn with Uvicorn workers (`gunicorn app.main:app -w 4 -k uvicorn.workers.UvicornWorker`).

---

## 2. Environment Variables & Security
- [x] **No Secrets Committed**: Hardcoded production database credentials removed from repository source code.
- [x] **Environment Template**: Complete `.env.example` templates created at project root, `backend/`, and `frontend/`.
- [x] **JWT Secret Key**: Unique 64-character hex secret configured (`SECRET_KEY`).
- [x] **Debug Mode**: `DEBUG=false` enforced in production configuration.
- [x] **CORS Security**: `BACKEND_CORS_ORIGINS` restricted to authorized production domain origin URLs.

---

## 3. Database Architecture & Migrations
- [x] **Neon PostgreSQL Connection**: Production database connection verified (`postgresql+asyncpg://...`).
- [x] **Alembic Database Migrations**: `alembic upgrade head` executes smoothly and automatically updates schema to head (`003_add_discount_to_sale_items`).
- [x] **No Local Dev DB References**: Local SQLite (`app.db*`) files removed from repository and added to `.gitignore`.
- [x] **Automated Seeding**: System automatically seeds default roles (`owner`, `admin`, `employee`), granular permissions, and initial owner user account on first application startup.

---

## 4. Frontend & Static Assets
- [x] **Next.js Fast Refresh & Production Server**: `npm start` serves pre-rendered static assets and dynamic SSR pages efficiently.
- [x] **Fonts & Styling**: Tailwind CSS, Radix UI dialogs, and Lucide icons load cleanly without missing assets or layout shifts.
- [x] **Responsive Layout**: Dashboard, tables, forms, and modals verified across mobile, tablet, and desktop breakpoints.

---

## 5. Core Business Modules Functional Verification
- [x] **Authentication & RBAC**: JWT token issue, refresh token rotation, login flow, role-based page access, and granular permission enforcement (`HasPermission`).
- [x] **Dashboard KPI Metrics**: All 8 Executive KPI cards query live PostgreSQL database data correctly (Total Sales, Total Cash Sales, Total Due Sales, Total Purchases, Total Expenses, Customer Due, Supplier Due, Total Profit).
- [x] **Sales & Invoices**: Invoice creation, line item calculation, payment status (paid, partial, unpaid), stock deduction, customer due adjustments, print vouchers (A4, A5, POS 80mm).
- [x] **Purchases & Bills**: PO creation, supplier due balance updates, stock auto-replenishment, payment status tracking.
- [x] **Expenses Module**: Category management, expense entry creation, list filtering, voucher printing, and real-time dashboard expense/profit aggregation.
- [x] **Customer Collections & Supplier Payments**: Payment voucher creation, customer/supplier due balance recalculations, ledger history adjustments.
- [x] **Returns Management**: Sale returns and product returns properly adjust inventory stock levels and customer/supplier balances.
- [x] **Controlled Hard Delete System**: Permanent cascading deletions protected by custom in-app modal (`HardDeleteModal`) requiring explicit `DELETE` confirmation text entry.
- [x] **Reports Central Hub**: Multi-range sales, purchases, collections, payments, and expense report generation with CSV/Excel export support.

---

## 6. Infrastructure & Backup Configuration
- [x] **Render Compatibility**: `render.yaml` blueprint configured with build and start commands for both backend web service and frontend web service.
- [x] **Database Automated Backups**: Neon PostgreSQL point-in-time recovery (PITR) and automated daily snapshots configured.
- [x] **Logging & Health Check**: API health endpoint `/api/v1/health` and GZip middleware active.
