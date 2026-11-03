# REST API

Base URL: `http://localhost:5000/api/v1` (development). In production use the public origin of your deployment. All JSON, UTF-8. The API is mounted in `backend/src/app.ts`; the health endpoint is at `/api/health`.

## Response Envelope

Every endpoint returns a consistent envelope:

```json
{
  "success": true,
  "message": "Listings retrieved",
  "data": { },
  "meta": {
    "total": 120,
    "page": 1,
    "limit": 20,
    "totalPages": 6,
    "hasNext": true,
    "hasPrev": false
  }
}
```

- `success` — boolean.
- `message` — human-readable summary.
- `data` — payload (object, array, or `null`).
- `meta` — present on paginated list endpoints.
- `errors` — present only on validation failures (see below).

## Error Envelope

Errors use the same envelope with `success: false`:

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Valid email is required" }
  ]
}
```

| Status | Case |
| --- | --- |
| 400 | Bad request (invalid parameters, invalid upload type) |
| 401 | Missing/invalid/expired access token, invalid credentials |
| 403 | Insufficient role, suspended account, not your resource, email not verified via `requireVerified` |
| 404 | Route or resource not found |
| 409 | Conflict (email/username taken, duplicate review) |
| 422 | Validation failure — `errors` carries `{ field, message }` |
| 429 | Rate limit exceeded (`Too many requests`) |
| 500 | Unhandled error (sanitized message in production) |

## Authentication

Two header values mark auth:

- `Access` — `Authorization: Bearer <accessToken>` (15-minute lifetime).
- `Refresh` — sent in the JSON body to `POST /auth/refresh` (7-day lifetime).

Public endpoints that optionally personalize results (e.g. marketplace detail returning `isFavorited`) accept the same Bearer token without requiring it.

## Pagination & Common Filters

List endpoints accept:

| Param | Description |
| --- | --- |
| `page` | 1-based page number (default 1). |
| `limit` | Items per page; bounded to `max 50` (conversation messages up to 100). Default 20. |

Marketplace, services, and accommodation lists also accept:

- `category` — category slug.
- `minPrice` / `maxPrice` — price bounds (marketplace uses `price`; services use the price range; accommodation uses `monthlyPrice`).
- `search` — substring match on title/description.
- `location` — substring match on location.
- `sort` — `newest` (default), `oldest`, `price_asc`, `price_desc`, `popular` (view count).

Marketplace adds `condition` (`NEW`, `USED_EXCELLENT`, `USED_GOOD`, `USED_FAIR`). Accommodation adds `propertyType` and the boolean filters `hasWifi`, `hasWater`, `hasElectricity`, `hasSecurity`, `hasParking`, `isFurnished`.

## Auth

All under `/auth`. `POST /login` and `POST /register` are subject to a stricter rate limit (20/15 min per IP).

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/register` | — | Register with email, username, password (≥8 chars), first/last name, optional phone and role (STUDENT default). Returns user + token pair. |
| POST | `/auth/login` | — | Email + password login. Returns user + token pair; updates `lastLoginAt`. |
| POST | `/auth/refresh` | Refresh token in body | Exchange a refresh token for a new access + refresh token pair. |
| GET | `/auth/profile` | Access | Full profile with roles, profile record, active listing counts. |
| PUT | `/auth/profile` | Access | Update first/last name, phone, bio (≤500), location, avatar. |
| POST | `/auth/change-password` | Access | Change password given `currentPassword` and `newPassword` (≥8 chars). |
| POST | `/auth/logout` | Access | Logs the session out client-side. |

## Marketplace

`/marketplace`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/marketplace` | Optional | List active listings (pagination + filters above). |
| GET | `/marketplace/my-listings` | Access | Current user's own listings. |
| GET | `/marketplace/:slug` | Optional | Listing detail; increments `viewCount`; includes `isFavorited` for the viewer. |
| POST | `/marketplace` | Access | Create a listing (created as `PENDING_REVIEW`). Requires title, description, `categoryId`, `price`, `condition`. |
| PUT | `/marketplace/:id` | Access | Update own listing (owner-only; reverts to `PENDING_REVIEW`). |
| DELETE | `/marketplace/:id` | Access | Soft-delete own listing (`deletedAt`). |
| POST | `/marketplace/:id/images` | Access | Upload up to 10 images (multipart `images`), owner-only. |

## Services

`/services`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/services` | Optional | List active services (pagination + filters). |
| GET | `/services/my-services` | Access | Current user's services. |
| GET | `/services/:slug` | Optional | Service detail with portfolio, review average, `isFavorited`. |
| POST | `/services` | Access | Create a service (requires title, description, `categoryId`; optional price range/type, availability). |
| PUT | `/services/:id` | Access | Update own service (owner-only; reverts to `PENDING_REVIEW`). |
| DELETE | `/services/:id` | Access | Soft-delete own service. |
| POST | `/services/:id/images` | Access | Upload service images (owner-only). |
| POST | `/services/:id/portfolio` | Access | Add a portfolio item (title; optional description, imageUrl, link, sortOrder). |

## Accommodation

`/accommodation`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/accommodation` | Optional | List active properties (pagination + filters incl. `propertyType` and amenity booleans). |
| GET | `/accommodation/my-properties` | Access | Current user's properties. |
| GET | `/accommodation/:slug` | Optional | Property detail with amenities and `isFavorited`. |
| POST | `/accommodation` | Access | Create a property (requires title, description, `categoryId`, `propertyType`, `location`, `monthlyPrice`). |
| PUT | `/accommodation/:id` | Access | Update own property (owner-only; reverts to `PENDING_REVIEW`). |
| DELETE | `/accommodation/:id` | Access | Soft-delete own property. |
| POST | `/accommodation/:id/images` | Access | Upload property images (owner-only). |
| POST | `/accommodation/:id/amenities` | Access | Attach amenities via `amenityIds` array (owner-only). |

## Favorites

`/favorites` — all endpoints require auth.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/favorites/toggle` | Toggle a favorite; body `targetType` (`MARKETPLACE`, `SERVICE`, `ACCOMMODATION`) + `targetId`. Returns `{ favorited: true|false }`. |
| GET | `/favorites` | List user's favorites, enriched with the current snapshot of each target. Optional `type` filter. |
| GET | `/favorites/check` | Query `targetType` + `targetId`; returns `{ isFavorited }`. |

## Reviews

`/reviews`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/reviews` | Access | Create a review; body `targetType` (`SELLER`, `SERVICE_PROVIDER`, `LANDLORD`, `BUSINESS`), `targetId`, `rating` (1–5), optional title/content. One review per author/target. |
| GET | `/reviews/:targetType/:targetId` | — | List reviews for a target with `averageRating` and `totalReviews`. |
| DELETE | `/reviews/:id` | Access | Soft-delete own review (`status = DELETED`). |

## Messages

`/messages` — all endpoints require auth.

| Method | Path | Description |
| --- | --- | --- |
| POST | `/messages/conversations` | Create or return an existing conversation with `userId`. |
| GET | `/messages/conversations` | List conversations with other participant and last message. |
| GET | `/messages/conversations/:id` | Thread of messages; marks participant's unread messages as read. |
| POST | `/messages/conversations/:id/messages` | Send a message (content ≤ 5000 chars); notifies other participants. |
| GET | `/messages/unread-count` | Unread message count. |

## Categories

`/categories`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/categories` | — | All active marketplace categories (tree-aware). |
| GET | `/categories/:slug` | — | Single category by slug. |
| POST | `/categories` | ADMIN | Create a category. |
| PUT | `/categories/:id` | ADMIN | Update a category. |
| DELETE | `/categories/:id` | ADMIN | Delete a category. |

## Search

`/search`

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/search?q=...` | — | Cross-entity search. Query `q` (required), `type` (`all`, `marketplace`, `services`, `accommodation`; default `all`). `all` returns up to 5 per group; otherwise paginated with `page`/`limit`. |

## Notifications

`/notifications` — all endpoints require auth.

| Method | Path | Description |
| --- | --- | --- |
| GET | `/notifications` | Notification feed (latest first), paginated. |
| PUT | `/notifications/:id/read` | Mark one notification read. |
| PUT | `/notifications/read-all` | Mark all notifications read. |
| GET | `/notifications/unread-count` | Unread notification count. |

## Admin

`/admin` — every route is guarded by `authenticate` + `authorize('ADMIN')` (see `backend/src/routes/admin.routes.ts`). Pagination uses `page`/`limit` (max 50).

| Method | Path | Description |
| --- | --- | --- |
| GET | `/admin/dashboard/stats` | Platform stats: user/listings counts by status, reports, revenue (sum of successful payments), pending verifications, recent users. |
| GET | `/admin/users` | List users; filters `role`, `search`, `status` (`active`/`suspended`/`inactive`). |
| PUT | `/admin/users/:id/suspend` | Suspend a user (`isSuspended`, `suspendedAt`). |
| PUT | `/admin/users/:id/activate` | Reactivate a user. |
| PUT | `/admin/users/:id/role` | Replace user's roles (body `roleName`). |
| GET | `/admin/marketplace/listings` | All marketplace listings; optional `status` filter. |
| PUT | `/admin/marketplace/listings/:id/status` | Moderate a listing; `ACTIVE` and `REJECTED` notify the owner. |
| GET | `/admin/reports` | List reports; filters `status`, `type` (`LISTING`, `SERVICE`, `ACCOMMODATION`, `USER`, `REVIEW`). |
| PUT | `/admin/reports/:id` | Update report `status` and optional `resolution`. |
| GET | `/admin/verification` | List verification requests; filters `status`, `type`. |
| PUT | `/admin/verification/:id` | Review a verification request (status + optional `rejectionReason`); notifies the user. |
| GET | `/admin/settings` | All system settings (grouped). |
| PUT | `/admin/settings` | Upsert settings; body `{ settings: [{ key, value }] }`. |
| GET | `/admin/audit-logs` | Browse audit logs; filters `entity`, `action`. |

## Payments & Promotions

Mounted directly under `/api/v1` (no prefix beyond the group). All require auth.

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| GET | `/payments` | Access | Current user's payment history. |
| GET | `/promotions/plans` | Access | Active promotion plans (pricing from DB). |
| GET | `/promotions/settings` | Access | Promotion-related system settings (`group = promotions`). |
| POST | `/promotions/purchase` | Access | Purchase a plan; body `planId`, `targetType`, `targetId`. Creates a `SUCCESSFUL` payment, activates `featuredAt` on the target, creates a `PROMOTION_ACTIVE` notification. |

## Health Check

`GET /api/health` — public, unversioned; returns `success`, environment, and timestamp.

---

## Examples

### Login

`POST /api/v1/auth/login`

```json
{
  "email": "student1@cavconnect.com",
  "password": "Student@12345"
}
```

`200 OK`

```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "user": {
      "id": 2,
      "email": "student1@cavconnect.com",
      "username": "student1",
      "firstName": "Alice",
      "lastName": "Nakato",
      "avatar": null,
      "roles": ["STUDENT"]
    },
    "accessToken": "<JWT>",
    "refreshToken": "<JWT>"
  }
}
```

### Marketplace Listing

`GET /api/v1/marketplace?page=1&limit=2&sort=newest`

`200 OK`

```json
{
  "success": true,
  "message": "Listings retrieved",
  "data": [
    {
      "id": 3,
      "title": "HP Pavilion Laptop i5/8GB/512GB SSD",
      "slug": "hp-pavilion-laptop-i5-8gb-512gb-ssd",
      "price": 1800000,
      "currency": "UGX",
      "condition": "USED_EXCELLENT",
      "status": "ACTIVE",
      "isNegotiable": true,
      "location": "Kampala",
      "category": { "id": 3, "name": "Laptops", "slug": "laptops" },
      "user": {
        "id": 2,
        "username": "student1",
        "firstName": "Alice",
        "lastName": "Nakato",
        "avatar": null
      },
      "images": []
    }
  ],
  "meta": {
    "total": 3,
    "page": 1,
    "limit": 2,
    "totalPages": 2,
    "hasNext": true,
    "hasPrev": false
  }
}
```

### Validation Error

`POST /api/v1/auth/register` with an invalid email → `422 Unprocessable Entity`

```json
{
  "success": false,
  "message": "Validation failed",
  "errors": [
    { "field": "email", "message": "Valid email is required" }
  ]
}
```