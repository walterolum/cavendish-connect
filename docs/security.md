# Security

This document is a checklist mapping each security control in CAV CONNECT to where it is implemented, verified against the current code.

## Middleware Chain Order

All HTTP traffic crosses the ordered pipeline in `backend/src/app.ts`. Note the global limiter (1) runs before expensive body parsing (4), and CORS/compression are applied before business routes.

```
helmet → global rate-limit → auth rate-limit → express.json(10mb) / cookie-parser
      → cors → compression → morgan → /uploads static → /api/v1 routes → 404 → error handler
```

## Controls

| # | Control | Implementation | Status / Notes |
| --- | --- | --- | --- |
| 1 | **Security headers** | `app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))` (`app.ts:29`) | Helmet 8 sets CSP, HSTS, X-Content-Type-Options, frame/sniffing headers. Cross-origin resource policy is relaxed only so uploads can be fetched by the frontend origin. |
| 2 | **CORS** | `app.use(cors({ origin: config.cors.origin, credentials: true, methods: [...], allowedHeaders: [...] }))` (`app.ts:58`) | Origin restricted to `CORS_ORIGIN` (default `http://localhost:5173`). Bounded methods and headers. Configure per environment. |
| 3 | **Global rate limiting** | `rateLimit({ windowMs: 15 * 60 * 1000, max: 100 })` on `/api/` (`app.ts:34`) | Protects all endpoints from burst abuse; `429` with a JSON envelope. |
| 4 | **Auth rate limiting** | Two `rateLimit({ max: 20 })` instances on `/api/v1/auth/login` and `/register` (`app.ts:44`) | Strict limit (20 req / 15 min) against brute force and credential stuffing. |
| 5 | **Input validation** | `express-validator` chains on every route + `validate` middleware (`src/middleware/validate.ts`) returns `422` with per-field errors | Covers email/username/password rules, integer/float bounds, enum whitelists, string length caps (title ≤200, description ≤5000, message ≤5000), URL checks on portfolio links, and `isIn([...])` currency/type/status checks. |
| 6 | **JSON schema validation (client)** | Zod schemas with React Hook Form (`zod` + `@hookform/resolvers` in `frontend/package.json`) | Reinforces validation client-side; server validation remains authoritative. |
| 7 | **JWT handling** | Dual secrets, short access lifetime (`15m`), refresh rotation (`7d`), `helpers.ts` (`sign`/`verify`) | Access token verified on every authenticated request (`middleware/auth.ts`); refresh token verified only at `/auth/refresh` with a fresh account/suspension check. |
| 8 | **Password hashing** | bcryptjs with 12 rounds (`SALT_ROUNDS` in `src/utils/helpers.ts`) | Applied on register and change-password; never stored in plaintext. |
| 9 | **XSS protection** | React 19 escapes rendered content by default (no `dangerouslySetInnerHTML` in the frontend); `helmet` sets X-Content-Type-Options; express-validator uses `normalizeEmail` and length caps on text fields | Note: `xss-clean` is a declared backend dependency but is **not yet mounted** in `app.ts`. Enable it (or an equivalent sanitizer) before surfaces that echo user HTML. Also scope any future `dangerouslySetInnerHTML` (e.g. rich-text descriptions) with a sanitizer. |
| 10 | **SQL injection** | All queries go through the Prisma ORM with parameterized queries; user input feeds `where` clauses as Prisma filter objects, never concatenated SQL | Additional guard: `limiter` runs before parsing; Prisma prepared statements protect against injection. |
| 11 | **File upload validation** | `src/middleware/upload.ts` (Multer): allowlist `image/jpeg, image/jpg, image/png, image/webp, image/gif`, `limits.fileSize = MAX_FILE_SIZE` (default 5242880 = 5 MB), UUIDv4 filenames, max 10 files via `upload.array('images', 10)` | Non-image mimetypes rejected with `400 BadRequestError`. Disk storage is local (dev/self-host); swap to object storage for production. |
| 12 | **Audit logging** | `src/middleware/audit.ts`: `auditLog()` writes actor, action, entity, entityId, old/new JSON values, IP (from `x-forwarded-for`), user agent to `AuditLog`; `auditMiddleware` decorates routes. Admin UI browses `GET /admin/audit-logs` | Failures are logged but never block the request. |
| 13 | **Secrets in environment variables** | `src/config/index.ts` reads `JWT_SECRET`, `JWT_REFRESH_SECRET`, `DATABASE_URL`, etc.; `.gitignore` excludes `.env`/`.env.*.local` | `.env.example` ships placeholders only. Rotate secrets per environment. |
| 14 | **No sensitive data exposure** | Controllers/service projections never return `passwordHash`, `refreshToken` beyond the explicit response, or internal fields. Errors in production return a generic `Internal server error` (stack trace development-only, `errorHandler.ts:19`); MVPs do not log request bodies | Check: `AuthService.getProfile` returns only public profile fields; admin user list selects a bounded field set; `errorHandler` logs only `err` to server console. |
| 15 | **Admin access control** | `router.use(authenticate, authorize('ADMIN'))` at the top of `src/routes/admin.routes.ts`; `authorize` returns `403` on insufficient roles; admin actions validate IDs and role names | The admin surface is closed by default; every route beneath it inherits the guard. |
| 16 | **Account state enforcement** | `requireVerified` middleware blocks unverified and suspended accounts where used; `AuthService.login` and `refreshToken` reject `isSuspended`/`!isActive` | Suspended users lose access at login and on every token refresh. |
| 17 | **Signature/URL compression** | `compression` middleware reduced response size | Deltas only; no security risk. |

## Additional Hardening (Recommended)

- **Mount `xss-clean`** (or your own input sanitizer) and **`hpp`** (HTTP parameter pollution is also declared in `package.json` but not mounted) after body parsing.
- **Cookie-based refresh tokens** with `httpOnly` + `sameSite=strict` as an alternative to returning the refresh token in JSON; currently the SPA stores both tokens in `localStorage` (XSS-exfiltratable in theory).
- **Email verification** already exists in the schema (`isEmailVerified`, `requireVerified`); wire the SMTP config (`EMAIL_*` in `.env`) to actually send verification links before enabling `requireVerified` on public flows.
- **HTTPS everywhere** in production, with HSTS; terminate TLS at Nginx (see `docs/deployment.md`).
- **Fail2ban or CDN WAF** in front of the limiter for distributed brute-force prevention.
- **Sign-based uploads / AV scanning** if the platform grows to accept arbitrary file uploads (consider `storage.local` risks on a multi-user host).
- **Secrets rotation policy** and a secret manager for production.
- **Pen-test checklist**: 401 vs 403 differentiation, mass-assignment on `PUT` routes (bounded `data` objects), path traversal on `:slug` lookups (Prisma name-based, safe), and ownership checks (`Not your listing`).

## Reporting

Security issues should be reported privately to the platform operators. Include affected endpoints, payloads, and environment. Do not disclose until verified and remediated.