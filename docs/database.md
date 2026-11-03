# Database

CAV CONNECT uses **MySQL** with the schema owned by **Prisma** at `backend/prisma/schema.prisma` (an UTF-8-friendly MySQL datasource with `env("DATABASE_URL")`). Migrations are generated and applied with Prisma Migrate; the seed script (`backend/src/prisma/seed/index.ts`) populates roles, demo users, categories, amenities, and system settings.

## Models

### Roles & Permissions

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Role` | Named role (STUDENT, SERVICE_PROVIDER, LANDLORD, VENDOR, ADMIN) with an optional description. | `users` → `UserRole`, `permissions` → `Permission` (many-to-many) |
| `Permission` | A named capability (`name`) scoped by `resource` + `action`. | `roles` → `Role` |
| `UserRole` | Join table linking users to roles, unique per `(userId, roleId)` with cascading deletes. | `user`, `role` |

### Users

| Model | Purpose | Key relations |
| --- | --- | --- |
| `User` | Account record: email/username (unique), `passwordHash`, identity fields, phone, avatar, bio, location, `universityAffiliation`, verification/active/suspended flags, `lastLoginAt`, soft-delete `deletedAt`. | `roles`, `profile`, `verificationRequests`, `marketplaceListings`, `services`, `properties`, `favorites`, conversations/messages, `reviewsWritten`, `reportsSubmitted`, `notifications`, `promotionPurchases`, `payments`, `auditLogs`, `subscriptions` |
| `Profile` | Optional public profile (display name, cover photo, website, social links JSON) unique per user. | `user` (unique, cascade) |

### Verification

| Model | Purpose | Key relations |
| --- | --- | --- |
| `VerificationRequest` | A user's request to be verified as STUDENT, SERVICE_PROVIDER, LANDLORD, or BUSINESS with document URL/data and a review trail (reviewer, notes, rejection reason). | `user` |

### Categories

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Category` | Marketplace category tree (slugs, icon/image, parent/child self-relation, sort order, active flag). | `parent`/`children` self-relation, `listings` |
| `ServiceCategory` | Category for service listings. | `services` |
| `PropertyCategory` | Category for accommodation listings. | `properties` |

### Marketplace

| Model | Purpose | Key relations |
| --- | --- | --- |
| `MarketplaceListing` | Product listing: title/slug, description, `price` (Decimal(12,2)), currency, condition, quantity, location/geo, status (DRAFT → PENDING_REVIEW → ACTIVE → SOLD/EXPIRED/...), `viewCount`, `featuredAt`, `expiresAt`, soft-delete. | `user`, `category`, `images` |
| `MarketplaceListingImage` | Listing photos with sort order and a primary flag. | `listing` (cascade) |

Enums: `ListingCondition` (NEW, USED_EXCELLENT, USED_GOOD, USED_FAIR), `ListingStatus` (DRAFT, PENDING_REVIEW, ACTIVE, SOLD, EXPIRED, REJECTED, SUSPENDED).

### Services

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Service` | A service offering: price range (`priceMin`/`priceMax`), `priceType`, availability, status, view count, `featuredAt`, soft-delete. | `user`, `serviceCategory`, `images`, `portfolios` |
| `ServiceImage` | Service photos. | `service` (cascade) |
| `ServicePortfolio` | A service provider's portfolio item (title, description, image/link, sort order). | `service` (cascade) |

### Accommodation

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Property` | Rental property: property type, location/geo, `monthlyPrice`, `depositAmount`, rooms, room type, furnished/utility flags (wifi, water, electricity, security, parking), rules, status, soft-delete. | `user`, `propertyCategory`, `images`, `amenities` |
| `PropertyImage` | Property photos. | `property` (cascade) |
| `PropertyAmenity` | Join table linking properties to amenities, unique per `(propertyId, amenityId)`. | `property`, `amenity` |
| `Amenity` | Catalog of reusable amenities (Wi-Fi, Water, Electricity, Security, Parking, ...) with icon and active flag. | `properties` → `PropertyAmenity` |

Enum: `PropertyType` (HOSTEL, SINGLE_ROOM, SHARED_ROOM, APARTMENT, HOUSE, BEDSITTER, OTHER).

### Favorites

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Favorite` | Polymorphic favorite record: `targetType` + `targetId` (plain FK), unique per `(userId, targetType, targetId)`. | `user`; target resolved in service layer |

Enum: `FavoriteType` (MARKETPLACE, SERVICE, ACCOMMODATION).

### Messaging

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Conversation` | A private conversation with a creator and participants. | `creator`, `participants`, `messages` |
| `ConversationParticipant` | Membership in a conversation with `lastReadAt`, unique per `(conversationId, userId)`. | `conversation`, `user` |
| `Message` | A message with content (Text), read flag, and sender. | `conversation`, `sender` |

### Reviews

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Review` | A 1–5 star review with title/content/status, polymorphic via `targetType` + `targetId`, unique per `(authorId, targetType, targetId)`. | `author`; target resolved in service layer |

Enums: `ReviewType` (SELLER, SERVICE_PROVIDER, LANDLORD, BUSINESS), `ReviewStatus` (ACTIVE, HIDDEN, DELETED).

### Reports

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Report` | Moderation report: reason, optional description, status workflow (OPEN → UNDER_REVIEW → RESOLVED/REJECTED), reviewer and resolution fields. Polymorphic via `targetType` + `targetId`. | `reporter`; target resolved in service layer |

Enums: `ReportType` (LISTING, SERVICE, ACCOMMODATION, USER, REVIEW), `ReportReason` (SCAM, FRAUD, FAKE_PRODUCT, FAKE_ACCOMMODATION, INAPPROPRIATE_CONTENT, HARASSMENT, DUPLICATE_LISTING, WRONG_INFORMATION, OTHER), `ReportStatus` (OPEN, UNDER_REVIEW, RESOLVED, REJECTED).

### Notifications

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Notification` | In-app notification: type, title, message, optional target reference, read flag. Created on message, listing approval/rejection, verification updates, promotion activation, etc. | `user` (recipient), `actor` (triggering user, `SetNull` on delete) |

Enum: `NotificationType` (NEW_MESSAGE, LISTING_APPROVED, LISTING_REJECTED, LISTING_EXPIRED, NEW_INQUIRY, REVIEW_RECEIVED, VERIFICATION_STATUS, PROMOTION_ACTIVE, SYSTEM_ANNOUNCEMENT, REPORT_UPDATE).

### Payments & Promotions

| Model | Purpose | Key relations |
| --- | --- | --- |
| `Payment` | Generic payment record: amount (Decimal), currency (default UGX), status, optional provider/provider ref and JSON metadata. Provider-agnostic by design. | `user` |
| `PromotionPlan` | A purchasable promotion (FEATURED, PREMIUM, SPONSORED, BUSINESS_PLAN) with price, duration, currency, active flag, sort order. | `purchases` |
| `PromotionPurchase` | A user's purchase of a plan against a target (`targetType` + `targetId`), with activation dates and linked payment. | `user`, `plan` |
| `SubscriptionPlan` | A vendor/business subscription plan (price, duration, features JSON). | `subscriptions` |
| `Subscription` | An active subscription instance with start/end dates, auto-renew, status, linked payment. | `user`, `plan` |

Enums: `PaymentStatus` (PENDING, SUCCESSFUL, FAILED, CANCELLED, REFUNDED), `PromotionType` (FEATURED, PREMIUM, SPONSORED, BUSINESS_PLAN), `SubscriptionStatus` (ACTIVE, EXPIRED, CANCELLED, SUSPENDED).

### System & Audit

| Model | Purpose | Key relations |
| --- | --- | --- |
| `SystemSetting` | Key/value configuration with a `group` and type — including `promotion.featured_price`, `listing.free_limit`, `platform.*`, and `maintenance.mode`. Read by services, edited via the admin settings API. No deploy needed to change prices or limits. | — |
| `AuditLog` | Append-only trail of admin/user actions: actor, action, entity, entityId, old/new values, IP address, user agent. | `user` (SetNull on delete) |

## Cross-Cutting Patterns

### Role-Based Access Control

Access is data-driven: a user has many roles through `UserRole`, roles have many permissions through `Permission`. The API enforces access at two levels:

1. `authenticate` — extracts the JWT and attaches `{ userId, email, roles }`.
2. `authorize(...roles)` — checks the decoded role list against required roles (e.g. `authorize('ADMIN')` guards every admin route).

`requireVerified` additionally checks `isEmailVerified` and `isSuspended` on the account row.

### Soft Deletion

`User`, `MarketplaceListing`, `Service`, and `Property` carry a nullable `deletedAt`. Deletes are performed as `UPDATE ... SET deletedAt = now()` and every read path filters `deletedAt: null` (kept consistent in the service layer, e.g. `MarketplaceService`). This preserves favorites, reviews, notifications, and audit history, and enables accidental-delete recovery.

### Audit Logging

`AuditLog` stores who did what to which entity, with `oldValues`/`newValues` JSON snapshots plus `ipAddress` and `userAgent`. Writes flow through `src/middleware/audit.ts` (`auditLog` helper and `auditMiddleware` decorator) and are browsable in the admin interface. Audit failures are logged but never block the primary request.

### DB-Configurable Settings

`SystemSetting` stores platform-level configuration as typed strings (string/number/boolean) grouped logically (`general`, `listings`, `promotions`, `verification`, `system`). The admin `PUT /api/v1/admin/settings` upserts these keys. Promotion pricing uses this mechanism together with the `PromotionPlan` table — e.g. `promotion.featured_price` (15000 UGX / 7 days), `premium_price` (35000 / 14), `sponsored_price` (60000 / 30) are seeded defaults, not hard-coded.

### Polymorphic Pattern (Favorites / Reviews / Reports)

`Favorite`, `Review`, and `Report` each store a discriminated `targetType` plus a plain `targetId` integer. The concrete target tables are not referenced by a database FK; instead each service:

1. Validates `targetType` against a whitelist (e.g. `['MARKETPLACE', 'SERVICE', 'ACCOMMODATION']` for favorites).
2. Resolves and enriches the target when a payload is needed (e.g. `FavoritesService.getUserFavorites` loads the matching listing/service/property row and shapes the response).
3. Uses the `@@unique`/`@@index([targetType, targetId])` composite constraints to keep lookups indexed and enforce one-per-user-per-target semantics.

**Why this design?** A true polymorphic FK is not expressible in MySQL/Prisma. Alternatives — a nullable FK column per target type or a generic table per type — add schema clutter, nullable columns, or duplicated code. Keeping the type+ID on the row with app-layer resolution keeps the schema minimal, the constraints strong (uniqueness, indexing), and the addition of new target types a one-file change in the service whitelist rather than a migration.