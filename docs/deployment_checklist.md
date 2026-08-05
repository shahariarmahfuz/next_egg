# Production Deployment Checklist

## Deployment Environment Verification

- [x] Host Server: Linux Ubuntu 22.04 LTS / Debian 12
- [x] Docker Engine: v24.0+
- [x] Docker Compose: v2.20+
- [x] Ports Open: `80` (HTTP), `443` (HTTPS)

---

## Pre-Flight Verification Commands

1. **Verify Environment Variables**:
   ```bash
   test -f .env && echo "OK: .env file exists" || echo "ERROR: Missing .env"
   ```

2. **Build Docker Containers**:
   ```bash
   docker compose -f docker-compose.prod.yml build
   ```

3. **Launch Container Services**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d
   ```

4. **Verify Container Liveness**:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```

5. **Verify API Endpoint Ping**:
   ```bash
   curl -s http://localhost/health | grep '"status":"ok"' && echo "API Health OK"
   ```
