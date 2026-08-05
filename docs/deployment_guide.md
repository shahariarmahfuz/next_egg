# Production Deployment Guide

## Overview
This guide provides step-by-step instructions for deploying the **Enterprise Business Management System** to a production environment using Docker containers, Nginx reverse proxy, and Neon PostgreSQL.

---

## 1. Prerequisites
- **Linux Host**: Ubuntu 22.04 LTS or Debian 12 recommended.
- **Docker Engine**: v24.0+ and **Docker Compose**: v2.20+ installed.
- **Domain & SSL**: Valid A-records pointing to server IP and SSL certificates (e.g., Let's Encrypt / Certbot).
- **PostgreSQL Database**: Neon Cloud PostgreSQL or managed PostgreSQL 15+.

---

## 2. Environment Preparation

1. **Clone Repository**:
   ```bash
   git clone https://github.com/shahariarmahfuz/next_egg.git
   cd next_egg
   ```

2. **Configure Environment Variables**:
   Copy `.env.example` to `.env` and fill in production secrets:
   ```bash
   cp .env.example .env
   ```

3. **Generate JWT Secret**:
   ```bash
   openssl rand -hex 32
   ```
   Set `SECRET_KEY` in `.env` with the output.

---

## 3. Docker Production Deployment

1. **Build & Start Services**:
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```

2. **Verify Container Health**:
   ```bash
   docker compose -f docker-compose.prod.yml ps
   ```
   All services (`enterprise_frontend_prod`, `enterprise_backend_prod`, `enterprise_proxy_prod`) should show status `healthy` / `running`.

3. **View Logs**:
   ```bash
   docker compose -f docker-compose.prod.yml logs -f --tail=100
   ```

---

## 4. Reverse Proxy & Nginx Routes

Nginx automatically routes inbound HTTP/HTTPS traffic:
- `http://yourdomain.com/` &rarr; Proxied to Next.js Frontend (`frontend:3000`)
- `http://yourdomain.com/api/v1/` &rarr; Proxied to FastAPI Backend (`backend:8000/api/v1/`)
- `http://yourdomain.com/health` &rarr; Backend liveness health check

---

## 5. SSL / TLS Setup (Certbot)

To enable SSL on port 443 with Let's Encrypt:
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d yourdomain.com
```
