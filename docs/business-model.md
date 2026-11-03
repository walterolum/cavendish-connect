# Business Model

CAV CONNECT operates a freemium marketplace for the Cavendish University Uganda community. Basic access is free; revenue comes from promotion plans, subscriptions, and (planned) advertising and transaction services.

## The Model in One Line

Free to join, browse, list, and message. Sellers and landlords pay only when they want visibility beyond the free tier; businesses pay for ongoing presence.

## Revenue Streams

| Stream | Who pays | What they get | Status |
| --- | --- | --- | --- |
| **Featured listings** | Students, vendors, landlords | A promotion that flags a marketplace listing, service, or property so it stands out in lists and search. | Implemented (`PromotionPlan` type `FEATURED`) |
| **Premium listings** | Sellers | Higher-visibility tier with a longer duration and stronger placement. | Implemented (`PREMIUM`) |
| **Sponsored listings** | Sellers, vendors | Top-of-feed sponsored placement, longest duration. | Implemented (`SPONSORED`) |
| **Business / vendor subscription plans** | Businesses, vendors, service providers | Recurring subscriber status (monthly/annual) with bundled benefits (e.g. verified badge, multiple listings, promotion allowances). | Implemented data model (`SubscriptionPlan`/`Subscription`, `BUSINESS_PLAN` promotion type) |
| **Advertising to students** | Campus-adjacent businesses (housing agents, cafes, textbook suppliers, telecoms, banks) | Targeted ad placements within feed, category, and search results. | Planned |
| **Transaction fees / escrow** | Buyers/sellers completing high-value deals | A small fee on transacted value for a secure, escrowed payment. | Future direction; depends on the payment abstraction |

The free tier is governed by DB settings, not code: `listing.free_limit` (10) and `listing.free_days` (30) cap how many listings a user can post and how long they stay active before a paid promotion is relevant. Change the caps in the admin settings without a deploy.

## Database-Driven Pricing (No Hard-Coded Prices)

Promotion prices are **never hard-coded**. They live in two places in the database:

1. **`PromotionPlan` table** (`backend/src/prisma/schema.prisma`) — the purchasable plans themselves: name, description, `type` (`FEATURED | PREMIUM | SPONSORED | BUSINESS_PLAN`), `price`, `currency` (UGX), `durationDays`, `isActive`, `sortOrder`. Served to clients by `GET /api/v1/promotions/plans`.
2. **`SystemSetting` table** under the `promotions` group — seeded defaults used as ground truth of current pricing/limits:
   - `promotion.featured_price` = 15000 UGX, `promotion.featured_days` = 7
   - `promotion.premium_price` = 35000 UGX, `promotion.premium_days` = 14
   - `promotion.sponsored_price` = 60000 UGX, `promotion.sponsored_days` = 30

`PromotionService.getPromotionSettings()` reads these keys from `SystemSetting`, and admin operators manage both tables through `PUT /api/v1/admin/settings` and the `PromotionPlan` store — no deployment required to change a price or run a promotion.

## Purchase Flow

1. Seller selects a plan on the frontend.
2. `PromotionService.purchasePromotion()` creates a `Payment` (status `SUCCESSFUL`, provider-aware record) plus a `PromotionPurchase` linking user, plan, and target (`targetType` + `targetId`), computing `endDate` from `durationDays`.
3. The target's `featuredAt` is set, making it surface in featured placements.
4. A `PROMOTION_ACTIVE` notification confirms activation to the seller.

## Payment Abstraction Layer

All money movement passes through the `Payment` model and `PaymentService`:

- `Payment` stores `amount`, `currency` (default **UGX**), `status` (`PENDING → SUCCESSFUL/FAILED/...`), optional `provider` and `providerRef`, and free-form `metadata` (`Json`).
- `PaymentService.createPayment()`/`processPayment()` are the single API for recording and settling payments.

This abstraction is deliberately provider-agnostic. Today promotions mark payments as settled directly; tomorrow the same code path can route through:

- **Mobile money** (MTN MoMo / Airtel Money), the dominant retail rail in Uganda;
- **Card payments** via card processors;
- **Bank transfers**.

Only the `provider` field and an adapter change — order and promotion logic stay intact. UGX is the primary currency throughout the schema (`currency` defaults to `"UGX"`), with USD/KES/TZS accepted as alternate listing currencies per-route validation.

## Fiscal & Risk Notes

- All revenue-affecting figures are traceable in `Payment` (amount, currency, status, provider, timestamps) and correlate back to `PromotionPurchase`/`Subscription`.
- Admin revenue reporting already aggregates successful `Payment` amounts in the dashboard stats.
- Future escrow/transaction fees should extend the same `Payment` flow to keep one auditable money trail rather than introducing a parallel system.
- Pricing changes are operational tasks (DB), not engineering tasks — document them as such for the business team.