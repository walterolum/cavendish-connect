# Architecture

CAV CONNECT is a monorepo (npm workspaces) with two applications sharing one MySQL database: a React SPA (`frontend/`) and a Node.js/Express/TypeScript REST API (`backend/`). The API is versioned under `/api/v1` and the schema is owned by Prisma in `backend/prisma/schema.prisma`.

## Monorepo Structure

```
cav-connect/
├── package.json          # Root: npm workspaces + orchestration scripts
├── frontend/             # Vite + React SPA (port 5173 dev)
└── backend/              # Express API (port 5000 dev)
```

The root `package.json` defines `workspaces: ["backend", "frontend"]` and a small set of orchestration scripts (`dev`, `build`, `migrate`, `seed`, `studio`). In development, `concurrently` runs both workspaces; the Vite dev server proxies `/api` and `/uploads` to `http://localhost:5000`, so API URLs stay relative and absolute.

## Frontend Architecture

The frontend is a feature-based React 19 SPA. Feature areas (marketplace, services, accommodation, admin, auth, messages, profile, explore, home) each live as a folder under `src/pages/`, with shared primitives separated from feature code:

- `src/components/ui/` — low-level primitives (button, input, card, badge, loading).
- `src/components/listing/` — reusable listing cards (ListingCard, ServiceCard, PropertyCard).
- `src/components/layout/` — Navbar, Footer, BottomNav wrappers.
- `src/pages/<feature>/` — route components per feature area.
- `src/services/` — typed API modules (auth, marketplace, listing) wrapping the Axios client.
- `src/lib/` — the shared Axios instance and generic helpers.
- `src/hooks/` — shared React hooks.
- `src/store/` — Zustand stores.

### State Management

Two complementary tools are used:

- **Zustand** for local client state. `src/store/auth.ts` holds the authenticated user, access token, and refresh token with `persist` to `localStorage`, plus role helpers (`hasRole`, `isAdmin`).
- **TanStack Query** for server state. `src/App.tsx` configures the `QueryClient` (30s stale time, single retry, no refetch on window focus). Pages declare data via `useQuery`/`useMutation` keyed by feature (e.g. `['home', 'listings']`).

### API Client

`src/lib/api.ts` exports an Axios instance with:

- Base URL from `VITE_API_URL` (default `/api/v1`).
- A request interceptor attaching `Authorization: Bearer <accessToken>` from the auth store.
- A response interceptor that transparently refreshes tokens on `401` (single retry per request, skipping auth endpoints) and rotates tokens through the store.

### Routing & Forms

Routing uses React Router v7 (`src/routes/AppRoutes.tsx`) with routes for every feature including `/marketplace`, `/services`, `/accommodation`, `/explore`, `/messages`, `/profile`, `/post`, and `/admin`. Forms use React Hook Form with Zod schemas (schema runtime validation). Toasts use Sonner; motion transitions use Framer Motion.

### PWA

Vite's `vite-plugin-pwa` (`frontend/vite.config.ts`) generates an auto-updating service worker with a manifest (`CAV CONNECT`, standalone display), a `NetworkFirst` runtime cache for `/api/` responses, and a `CacheFirst` image cache for `/uploads/` with a 30-day expiry — making the app installable and the main browsing flow usable offline.

## Backend Architecture

The backend follows a three-layer request flow: **routes → controllers → services**, with middleware for cross-cutting concerns.

```
Express app (app.ts)
  └── middleware chain (security, rate limit, parsing, CORS, compression, logging)
  └── /api/health
  └── /api/v1 router
        ├── auth, marketplace, services, accommodation
        ├── favorites, reviews, messages, notifications
        ├── categories, search
        ├── admin (routes mounted with authenticate + authorize('ADMIN'))
        └── payments, promotions (mounted directly under /api/v1)
  └── notFoundHandler → errorHandler
```

- **Routes** (`src/routes/`) define HTTP verbs, paths, and `express-validator` validation chains. Each route resolves to a controller action and attaches auth middleware as required.
- **Controllers** (`src/controllers/`) translate HTTP (request parsing, response envelope via `successResponse`) and delegate to services. They never touch Prisma directly.
- **Services** (`src/services/`) contain all business logic and database access through the Prisma client. Errors are thrown as typed `AppError` subclasses (`NotFoundError`, `UnauthorizedError`, `ForbiddenError`, `BadRequestError`, `ConflictError`, `ValidationError`).
- **Middleware** (`src/middleware/`): `auth` (authenticate, optionalAuth, authorize, requireVerified), `validate`, `upload` (Multer), `audit`, and the terminal `errorHandler`/`notFoundHandler`.
- **Utils** (`src/utils/`): typed error classes, the `{ success, message, data, meta }` response envelope, and JWT/bcrypt/slug helpers.

### Middleware Chain & Security Ordering

In `backend/src/app.ts` the pipeline is ordered deliberately:

1. `helmet` — security headers (with `crossOriginResourcePolicy: 'cross-origin'` to allow uploads to be fetched cross-origin).
2. Global rate limiter — 100 requests / 15 min per IP on `/api/`.
3. Stricter auth rate limiter — 20 requests / 15 min on `/api/v1/auth/login` and `/register`.
4. Body parsing — `express.json` / `urlencoded` with a 10 MB limit, then `cookieParser`.
5. CORS — allowed origins from `CORS_ORIGIN`, credentials enabled, bounded methods and headers.
6. Compression — gzip for all responses.
7. Morgan request logging (suppressed in test env; `combined` in production).
8. Static `/uploads`.
9. Route mounting under `/api/v1`.
10. `notFoundHandler` (404) then `errorHandler` (terminal; suppresses stack traces in production).

The rate limiters stop brute-force and abuse before body parsing costs; CORS and HTTPS headers are applied before any business route runs.

### Error Handling

`src/middleware/errorHandler.ts` distinguishes:

- `ValidationError` (422) — returns `{ success: false, message, errors }` with per-field errors produced by `src/middleware/validate.ts`.
- `AppError` subclasses — respond with their `statusCode` (400/401/403/404/409).
- Unknown errors — a 500 with a sanitized message in production, stack trace in development/tests.

Every controller wraps service calls in `try/catch` and forwards to `next(error)`.

### Audit Logging

`src/middleware/audit.ts` provides `auditLog()` (explicit calls) and `auditMiddleware(action, entity)` (auto-logs successful JSON responses on authenticated requests, capturing IP from `x-forwarded-for` and user agent). The `AuditLog` model stores old/new values as JSON.

## Data Flow

```
Browser (React SPA / PWA)
   │  fetch via Axios client (lib/api.ts)
   │  Bearer JWT attached; 401 triggers silent refresh
   ▼
Nginx / Vite proxy (/api, /uploads → :5000)
   ▼
Express app.ts middleware chain
   ▼
/api/v1/<route>  →  route validators  →  controller  →  service  →  Prisma  →  MySQL
   ▼
Response envelope { success, message, data, meta } back through the same path
```

Writes that change user-visible state (listing approval, verification, promotions, messages) additionally create `Notification` records, surfaced through `GET /api/v1/notifications`.

## Scaling Notes

The architecture is designed for growth beyond a single campus:

- **Multiple universities** — `User.universityAffiliation` and `User.location` already exist as fields, and `SystemSetting` keys (e.g. `platform.name`, `platform.currency`) are config-driven, so the platform can be white-labeled per institution without code changes. A `universityId` dimension can be added to the schema cleanly.
- **Search engine** — `/api/v1/search` currently runs `contains` queries across marketplace, services, and accommodation. For scale, this layer is isolated in `SearchService` (`backend/src/services/search.service.ts`) and can be swapped for a dedicated engine (e.g. Elasticsearch or Meilisearch) behind the same route contract.
- **WebSockets** — `socket.io` is already a backend dependency and messaging/notification tables are real-time-ready (`Conversation`, `ConversationParticipant`, `Message`, `Notification`). A socket layer can be added on top of the existing message send/create logic to push events instead of polling unread counts. Not yet wired in the HTTP app; the service layer owns all the state it would need.
- **Multi-tenancy** — roles/permissions are data-driven (`Role`, `Permission`, `UserRole`), settings are DB-backed, and no university-specific constants are hard-coded. Isolation can be introduced by scoping queries per tenant in the service layer.
- **Payments** — all flows go through `PaymentService.createPayment()`/`processPayment()`. Today promotion purchase marks payments `SUCCESSFUL` directly; hooking a real gateway means routing these calls to a provider adapter while keeping the rest of the transaction flow unchanged.

## Design Decisions

- **Polymorphic relations live in the service layer.** `Favorite`, `Review`, and `Report` use a plain `targetType` (enum/string) + `targetId` FK pattern rather than multiple nullable FKs or separate tables per content type. The valid target types are whitelisted and resolved in the matching service (`FavoritesService`, `ReviewsService`, and moderation paths in `AdminService`), which loads the concrete record and enriches the response. This keeps the Prisma schema simple and avoids schema churn when a new target type is added while centralizing safety in one place.
- **Plain FK `targetId` over database-level polymorphism.** MySQL (via Prisma) cannot express a genuine polymorphic FK. Using `targetId` with whitelisted type enums and application-level existence checks is explicit, indexable (`@@index([targetType, targetId])`), and avoids the brittleness of nullable FK columns.
- **Payment abstraction.** The `Payment` model stores `provider` and `providerRef` alongside generic metadata; `PaymentService` is the single entry point for creating and settling payments. This is deliberately independent of any specific gateway and can support mobile money, card, and bank transfers, with UGX as the primary currency.
- **Soft deletion.** Marketplace listings, services, properties, and users carry `deletedAt`; deletes are updates that filter on `deletedAt: null`. This preserves history, favorites, reviews, and audit trails.
- **Prices and fees configured in the database.** Promotion plans live in `PromotionPlan` and defaults are seeded into `SystemSetting` under the `promotions` group, so pricing changes never require a deploy.
- **Monorepo + workspace scripts.** A single `npm install` and root-level `npm run dev` boot both apps; shared conventions (TypeScript, `dist/` output, Prisma) keep the two workspaces consistent.