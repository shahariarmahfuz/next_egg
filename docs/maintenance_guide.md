# System Maintenance Guide

## Maintenance Tasks & Frequency

| Task | Command / Procedure | Schedule |
| :--- | :--- | :--- |
| **Log Rotation** | Docker log rotation (`max-size: 10m`) | Automated |
| **Database VACUUM & ANALYZE** | `psql -c "VACUUM ANALYZE;"` | Weekly |
| **Container Pruning** | `docker system prune -f` | Monthly |
| **Security Package Patches** | `apt update && apt upgrade -y` | Monthly |
