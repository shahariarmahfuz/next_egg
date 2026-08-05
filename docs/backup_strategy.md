# Database Backup Strategy

## Backup Objectives
- **Recovery Point Objective (RPO)**: < 1 hour
- **Recovery Time Objective (RTO)**: < 15 minutes
- **Retention Schedule**:
  - Hourly snapshots retained for 48 hours.
  - Daily backups retained for 30 days.
  - Monthly archives retained for 12 months.

---

## 1. Automated Neon Cloud Backups
Neon PostgreSQL provides continuous WAL archiving and automated point-in-time recovery (PITR) up to 30 days.

---

## 2. Automated Daily Server Backup Script

Create `/usr/local/bin/backup_bms_db.sh`:
```bash
#!/bin/bash
set -e

BACKUP_DIR="/var/backups/bms_postgresql"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
mkdir -p "$BACKUP_DIR"

# Perform compressed custom-format pg_dump
pg_dump "$DATABASE_URL" -F c -b -v -f "$BACKUP_DIR/bms_db_$TIMESTAMP.dump"

# Remove backups older than 30 days
find "$BACKUP_DIR" -type f -name "*.dump" -mtime +30 -delete

echo "Backup completed successfully at $(date)"
```
