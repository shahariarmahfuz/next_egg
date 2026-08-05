# Database Restore Strategy

## Restoration Procedure

In the event of database corruption or hardware failure, follow this restoration sequence.

---

## 1. Step-by-Step Restoration Commands

1. **Stop Application Backend to Prevent Writes**:
   ```bash
   docker compose -f docker-compose.prod.yml stop backend
   ```

2. **Execute Database Restore**:
   ```bash
   pg_restore --clean --if-exists --no-owner --no-privileges \
     -d "$DATABASE_URL" \
     /var/backups/bms_postgresql/bms_db_20260804_120000.dump
   ```

3. **Restart Backend Service**:
   ```bash
   docker compose -f docker-compose.prod.yml start backend
   ```

4. **Verify System Integrity**:
   - Verify health check: `curl -i http://localhost/health`
   - Log into UI and inspect recent transaction data.
