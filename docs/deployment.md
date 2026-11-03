# Deployment

## Quick start: Railway (recommended)

The repository deploys as **one service** (the Dockerfile at the root builds the
website and the API together) plus a **MySQL** database and a **volume** for
uploaded photos. Every push to `main` redeploys automatically.

1. Sign in at https://railway.com with GitHub and choose **New Project → Deploy from GitHub repo** → this repository.
2. In the project, click **+ Create → Database → MySQL**.
3. Open the app service → **Variables** and add:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | `${{MySQL.MYSQL_URL}}` (reference to the MySQL service) |
   | `JWT_SECRET` | 64 random characters |
   | `JWT_REFRESH_SECRET` | a different 64 random characters |
   | `NODE_ENV` | `production` |
   | `STORAGE_PATH` | `/data/uploads` |
   | `ADMIN_EMAIL` | the first admin's email |
   | `ADMIN_PASSWORD` | a long password (10+ characters) |

   Generate a secret with: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`

4. App service → **Settings → Volumes → Add volume**, mount path `/data`. (Uploaded photos live here and survive redeploys.)
5. App service → **Settings → Networking → Generate domain** (or add your own domain).
6. Open the domain, sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`, then fill in **Admin → Settings** (support email, phone).

On every start the container runs `prisma migrate deploy`, then the seed script
(which only creates missing roles, categories and settings and the first admin,
and never touches existing data), then the server. Health check: `/api/health`.

---

## Reference architecture (self-hosted)

A production deployment of CAV CONNECT consists of a CDN/static host for the frontend PWA, one or more Node.js API servers, a MySQL database, and a storage location for uploads.

## Architecture

```
                         ┌──────────────────────────────┐
                         │  Student / Vendor / Landlord │
                         │    (PWA / mobile browser)    │
                         └──────────────┬───────────────┘
                                        │ HTTPS (TLS 1.2+)
                                        ▼
                          ┌─────────────────────────────┐
                          │   CDN / Reverse Proxy       │
                          │   (Nginx + caching)         │
                          └──────┬──────────────┬───────┘
                                 │              │
                    /api, /uploads│              │/ (static SPA)
                                 ▼              │
                      ┌───────────────────┐      │   frontend dist/
                      │ Node.js API       │◄─────┘   (index.html, JS, PWA assets)
                      │  (Express, dist/) │
                      └────────┬──────────┘
                               │ Prisma
                               ▼
                    ┌─────────────────────┐
                    │   MySQL 8           │
                    │ (cavconnect schema) │
                    └─────────────────────┘
```

Uploads are stored locally under `./uploads` (dev default) and served at `/uploads`. For production, mount a persistent volume, or switch `STORAGE_PROVIDER` and the upload handler to object storage (e.g. an S3-compatible bucket) and serve images via CDN.

## Environment Configuration

Configuration is exclusively via environment variables read in `backend/src/config/index.ts` (source of truth: `backend/.env.example`).

### Separate Environments

| Env | Purpose | NODE_ENV | Notes |
| --- | --- | --- | --- |
| `development` | Local; Vite proxy to `http://localhost:5000`. | `development` | Query logging enabled; verbose errors. |
| `staging` | Pre-production; mirrors prod settings. | `staging` / `production` | Used to test migrations and releases with real data shapes. |
| `production` | Live. | `production` | Sanitized 500s, `combined` logging, query logging off. |

Keep three `.env` files (one per environment) — e.g. `.env.development`, `.env.staging`, `.env.production` — and never commit real secrets. `.gitignore` excludes `.env` variants.

### `.env.example` Mapping

| Variable | Meaning | Example |
| --- | --- | --- |
| `DATABASE_URL` | Prisma/MySQL connection string | `mysql://user:pass@db.example.com:3306/cavconnect` |
| `JWT_SECRET` | Access-token signing secret (long random) | `5f2c...` |
| `JWT_REFRESH_SECRET` | Refresh-token signing secret (separate) | `9a4b...` |
| `JWT_EXPIRES_IN` | Access token lifetime | `15m` |
| `JWT_REFRESH_EXPIRES_IN` | Refresh token lifetime | `7d` |
| `PORT` | API listen port | `5000` |
| `NODE_ENV` | Runtime mode | `production` |
| `CLIENT_URL` | Frontend origin used for CORS/email | `https://app.example.com` |
| `CORS_ORIGIN` | Allowed browser origin for CORS | `https://app.example.com` |
| `EMAIL_HOST` / `EMAIL_PORT` / `EMAIL_USER` / `EMAIL_PASSWORD` | SMTP for transactional mail | `smtp.example.com` / `587` |
| `STORAGE_PROVIDER` | Upload backend | `local` |
| `STORAGE_PATH` | Where files are written | `/var/lib/cavconnect/uploads` |
| `MAX_FILE_SIZE` | Upload byte limit (default 5242880 = 5 MB) | `5242880` |

Frontend build-time variables: `VITE_API_URL` (defaults to `/api/v1`). In production this should be a same-origin path so requests go through the reverse proxy.

## Deploying the Backend

```bash
# From the repo root (CI or deploy host)
npm install

# 1. Set production environment
export NODE_ENV=production
export DATABASE_URL="mysql://user:pass@db.example.com:3306/cavconnect"
# ... all other vars from .env.example

# 2. Generate the Prisma client + compile TypeScript
cd backend
npm run prisma:generate
npm run build                 # -> dist/

# 3. Apply schema changes (non-interactive)
npm run prisma:migrate:prod   # prisma migrate deploy

# 4. Seed once (roles, demo data, settings) — optional beyond first deploy
npm run prisma:seed

# 5. Start the compiled server
npm start                     # node dist/app.js
```

Run the API under a process manager (e.g. systemd, PM2) with restart-on-failure and log capture. Scale horizontally by adding app instances behind the reverse proxy (stateless app; sessions are stateless JWTs; uploads must be shared via the same volume/object storage).

## Deploying the Frontend

```bash
cd frontend
export VITE_API_URL=/api/v1
npm run build                 # tsc -b && vite build -> dist/
```

The `dist/` output (including the PWA manifest, icons, and generated service worker) is static. Serve it from Nginx or a CDN/object store. Configure SPA fallback so all routes fall back to `index.html` (the Workbox `navigateFallback` covers offline navigation).

## Reverse Proxy & HTTPS

HTTPS terminates at Nginx (`client_max_body_size`, TLS > 1.2, HSTS recommended). A minimal configuration:

```nginx
server {
    listen 443 ssl http2;
    server_name app.example.com;

    ssl_certificate     /etc/ssl/app.example.com.crt;
    ssl_certificate_key /etc/ssl/app.example.com.key;

    client_max_body_size 25m;          # room for multi-image uploads

    root /var/www/cavconnect/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;   # SPA fallback
    }

    location /api/ {
        proxy_pass http://127.0.0.1:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location /uploads/ {
        proxy_pass http://127.0.0.1:5000;
        expires 30d;                       # images are immutable once written
        add_header Cache-Control "public";
    }
}

server {
    listen 80;
    server_name app.example.com;
    return 301 https://$host$request_uri;   # force HTTPS
}
```

Important: the backend reads `x-forwarded-for` for audit IPs and rate limiting — the proxy chain above forwards it correctly. Set `CORS_ORIGIN` to the browser origin (`https://app.example.com`) unless serving frontend and API on the same origin (recommended; CORS then matters only for cross-origin scenarios).

## Database Operations

### Migrations

Use `prisma migrate deploy` for production (never `migrate dev`). Deploy migrations before starting the new app build to avoid schema/query mismatches.

### Backups

Automated `mysqldump` backups with retention, plus recovery and restore procedure, are documented in [Backups](backups.md).

### Maintenance Flags

`maintenance.mode` and other system settings are DB-backed (`SystemSetting`), so emergency flags can be toggled via the admin settings API without redeploying.

## Operations Checklist

- [ ] Strong unique `JWT_SECRET` / `JWT_REFRESH_SECRET` in production.
- [ ] `NODE_ENV=production` so error messages are sanitized.
- [ ] HTTPS enforced; HSTS enabled.
- [ ] `CORS_ORIGIN` restricted to the real frontend origin.
- [ ] Upload volume/object storage mounted and backed up (or treated as rebuildable).
- [ ] Scheduled `mysqldump` with off-site retention (see `docs/backups.md`).
- [ ] Log rotation for API and Nginx logs.
- [ ] Monitoring/alerting on health check `GET /api/health`.