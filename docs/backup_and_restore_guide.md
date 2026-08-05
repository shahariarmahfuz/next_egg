# Database Backup & Restore Guide

## Overview

This guide details automated and manual backup/restore procedures for the PostgreSQL database (Neon Cloud) used by the Business Management System.

---

## 1. Automated PostgreSQL Backups

If using Neon PostgreSQL, point-in-time recovery (PITR) and automatic daily snapshots are managed in the Neon Console.

For manual SQL dump backups:

### Create Compressed Database Dump
```bash
pg_dump "postgresql://neondb_owner:npg_2j3xCmEBeNcV@ep-jolly-glade-az8f29ac-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" \
  -F c -b -v -f backup_$(date +%Y%m%d_%H%M%S).dump
```

---

## 2. Restoring Database from Backup Dump

To restore a `.dump` backup file:

```bash
pg_restore --clean --if-exists --no-owner --no-privileges \
  -d "postgresql://neondb_owner:npg_2j3xCmEBeNcV@ep-jolly-glade-az8f29ac-pooler.c-3.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" \
  backup_20260804_120000.dump
```

---

## 3. Scheduled Automated Cron Backup Script

Create `/etc/cron.daily/db_backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/next_egg"
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

pg_dump "$DATABASE_URL" -F c -b -v -f "$BACKUP_DIR/db_$TIMESTAMP.dump"

# Retain backups for 30 days
find $BACKUP_DIR -type f -name "*.dump" -mtime +30 -delete
```

Make executable:
```bash
chmod +x /etc/cron.daily/db_backup.sh
```
