# Production Startup Guide

## Operational Checklist

Before launching the system into live production, execute this checklist to verify configuration readiness.

---

## 1. Environment & Configuration Check
- [x] `.env` file created from `.env.example`.
- [x] `SECRET_KEY` set to a unique 64-character hex string.
- [x] `DATABASE_URL` pointing to production Neon PostgreSQL DB with SSL enabled (`ssl=require`).
- [x] `APP_ENV` set to `production` and `DEBUG` set to `false`.

---

## 2. Startup Execution

Run the following command on your production server:

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

---

## 3. Automated Seeding & Database Migrations

During backend startup:
1. SQLAlchemy 2 initializes table structures automatically (`Base.metadata.create_all`).
2. Data seed script runs to register default roles (`owner`, `admin`, `employee`), default permissions (including `dashboard.view`, `reports.view`, `sales.*`, `purchase.*`, `product_return.*`, `supplier_payment.*`), and the initial Owner user.

---

## 4. Verification Steps

1. **Verify Backend Health**:
   ```bash
   curl -i http://localhost/health
   ```
   *Expected Response*: `{"status":"ok","service":"Business Management API"}`

2. **Verify Frontend UI**:
   Navigate to `http://yourdomain.com/login` in your web browser.

3. **Log In with Owner Account**:
   - **Username**: `owner`
   - **Password**: `Owner@123456`
   - *Note*: Immediately change password after initial log in.

---

## 5. Graceful Shutdown & Maintenance

To gracefully stop the production cluster:
```bash
docker compose -f docker-compose.prod.yml down
```
Gunicorn worker processes receive `SIGTERM` and finish active request processing within a 30-second window.
