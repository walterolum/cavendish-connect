# Testing

Current state: the backend exposes a `test` script (`jest --passWithNoTests`) and the frontend has `lint` via `oxlint`. **No automated test suite exists yet.** This document defines the testing strategy and the structure to build next.

## Strategy Overview

| Layer | Tool (recommended) | What to cover |
| --- | --- | --- |
| Backend unit | Jest + `ts-jest` | Services (pure business logic), validation chains, helpers (slug, JWT/bcrypt round-trip), response envelope/pagination. |
| Backend integration | Jest + Supertest | Auth flows, CRUD lifecycle per resource, polymorphic favorites/reviews/reports, ownership guards, notifications created as side effects, payments/promotions, admin authorization. |
| Backend E2E (DB) | Testcontainers or a dedicated MySQL schema | Full request → Prisma → MySQL round trips with migration + seed applied. |
| Frontend | Vitest + Testing Library (+ Mock Service Worker) | Forms (register/create listing), components, navigation guards, query hooks with mocked data. |
| E2E critical flows | Playwright | End-to-end journeys against a running dev/staging stack. |

## Unit Tests (Services & Utils)

Focus on the service layer — it holds the business rules and Prisma access. Use it to lock behavior without hitting HTTP.

Priority:

- `auth.service` — password hashing, duplicate email/username conflicts, suspended/inactive login rejection, refresh rotation and expired-token failure.
- `marketplace.service` / `services.service` / `accommodation.service` — ownership guards ("Not your listing"), soft-delete behavior, pagination metadata, `PENDING_REVIEW` status flow, slug generation.
- `favorites.service` — whitelist validation (`Invalid target type`), toggle on/off, uniqueness.
- `reviews.service` — duplicate-review `409`, rating bounds, aggregated average.
- `payment.service` / promotion purchase — plan pricing read from DB, `featuredAt` activation by `targetType`, notification emission.
- `utils/helpers` — `generateSlug` (title case, accents, length cap), `verifyAccessToken`/`verifyRefreshToken`, bcrypt round-trip.
- `utils/response` — `paginate` edge cases (empty set, exact multiples, last page `hasNext:false`).

Suggested layout:

```
backend/
└── __tests__/
    ├── unit/
    │   ├── helpers.test.ts
    │   ├── response.test.ts
    │   └── services/
    │       ├── auth.service.test.ts
    │       ├── marketplace.service.test.ts
    │       └── favorites.service.test.ts
    └── integration/
        ├── auth.test.ts
        ├── marketplace.test.ts
        ├── favorites.test.ts
        └── admin.test.ts
```

Service unit tests should mock `@prisma/client` (e.g. `jest.mock('../config/database')`) so they run fast and deterministic.

## Integration Tests (API + DB)

Bootstrap an isolated MySQL schema per run, apply `prisma migrate deploy`, seed, then use `supertest(app)` against the exported Express app (`backend/src/app.ts` — it already skips `morgan` when `NODE_ENV=test`).

Must-cover scenarios:

- **Auth**: register → login → `/profile` → refresh → logout; wrong passwords; suspended user blocked; `401` with no/malformed token; `422` validation payload shape.
- **Marketplace**: create returns `PENDING_REVIEW`, admin approve → appears in public list; owner-only update/delete; `deletedAt` hides from lists; `viewCount` increments.
- **Polymorphic behavior**: favorite a marketplace listing, service, and property; duplicate favorite uniqueness; enrich target when it exists; reviews against `targetType` whitelist.
- **Ownership/authorization**: non-owner `PUT/DELETE` → `403`; client hitting `/admin/*` without `ADMIN` → `403`.
- **Messages & notifications**: conversation creation de-duplicates, send message notifies the other participant's unread count.
- **Payments**: `GET /payments` history; purchase promotion sets `featuredAt` and emits `PROMOTION_ACTIVE`.
- **Settings**: admin updates `SystemSetting`; promotion prices reflect the change (proves no hard-coded prices).

Example test skeleton (Jest + Supertest):

```ts
// __tests__/integration/marketplace.test.ts
import request from 'supertest';
import app from '../../src/app';
import prisma from '../../src/config/database';
import { hashPassword } from '../../src/utils/helpers';

let token: string;

beforeAll(async () => {
  // create + login a STUDENT user
});

afterAll(async () => {
  await prisma.$disconnect();
});

it('creates a listing in PENDING_REVIEW', async () => {
  const res = await request(app)
    .post('/api/v1/marketplace')
    .set('Authorization', `Bearer ${token}`)
    .send({
      title: 'Test Laptop',
      description: 'Works great',
      categoryId: 1,
      price: 500000,
      condition: 'USED_GOOD',
    });

  expect(res.status).toBe(201);
  expect(res.body.success).toBe(true);
  expect(res.body.data.status).toBe('PENDING_REVIEW');
});
```

## Frontend Tests

Start with Vitest + React Testing Library for behavior, and Mock Service Worker (or Axios mock) so components test against the response envelope without a live API.

Priority:

- **Auth store** — persistence, `setTokens` rotation, `logout`, `hasRole`/`isAdmin`.
- **API client** — token attachment; silent-refresh retry on a single `401`; no retry on auth endpoints.
- **Forms** — register (validation errors displayed), create-listing (submits typed payload, resets on success).
- **Components** — ListingCard/ServiceCard/PropertyCard rendering of price/condition/status; navbar role-aware links.
- **Navigation** — protected-route behavior (redirect to `/login` without tokens).

Suggested layout:

```
frontend/src/
├── __tests__/
│   ├── stores/auth.test.ts
│   ├── lib/api.test.ts
│   └── components/
│       ├── listing/ListingCard.test.tsx
│       └── forms/RegisterForm.test.tsx
```

## E2E Critical Flows (Playwright)

Run against the dev/staging stack with the seed data. These are the journeys that must never regress:

1. **Guest browse** → home → marketplace listing list → detail (view count increments).
2. **Register** → verify → login → logout.
3. **Full promotion purchase** (the canonical money flow):
   - Login as vendor/student.
   - Create a marketplace listing.
   - Admin approves it (`/admin`).
   - Purchase a promotion plan (`/promotions/plans` → `purchase`).
   - Assert `featuredAt` reflects on the public listing and a `PROMOTION_ACTIVE` notification appears.
4. **Messaging** — user A opens conversation with user B, sends a message; B's unread count updates.
5. **Favorites** — toggle favorite, appear in favorites list, check state preserved across reloads.
6. **Reports & moderation** — report an item, admin resolves it, report status updates.
7. **Accommodation filters** — filter by `hasWifi`, price range, and `propertyType`.

Playwright structure:

```
e2e/
├── playwright.config.ts
└── tests/
    ├── auth.spec.ts
    ├── marketplace.spec.ts
    ├── promotions.spec.ts
    ├── messaging.spec.ts
    └── admin-moderation.spec.ts
```

## CI Pipeline (Recommended)

1. `npm run build --workspace backend` + `npm run build --workspace frontend` (type-check both).
2. Backend: migrate deploy → seed → `jest --runInBand` against the CI MySQL service.
3. Frontend: `vitest run` and `oxlint`.
4. E2E: build, start API + served `dist/`, run Playwright against `localhost`.

## Backend test script wiring

The `test` script currently runs `jest --passWithNoTests`. Add `ts-jest`, a `jest.config.js` mapping `ts-jest` for `src/**/*.ts` and `__tests__/**/*.ts`, and remove `--passWithNoTests` once suites exist so CI fails when tests are missing.