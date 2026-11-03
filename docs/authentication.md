# Authentication

CAV CONNECT uses a dual-token JWT session model. Authentication logic lives in `backend/src/services/auth.service.ts`, token/password primitives in `backend/src/utils/helpers.ts`, and enforcement middleware in `backend/src/middleware/auth.ts`.

## Flow

### Register

`POST /api/v1/auth/register` validates input (email, username 3–30 alphanumeric, password ≥8 chars, names required) then:

1. Rejects if the email or username is already taken (`409 Conflict`).
2. Hashes the password with **bcryptjs, 12 salt rounds**.
3. Resolves the default role (`STUDENT`, or the requested `STUDENT`/`SERVICE_PROVIDER`/`LANDLORD`/`VENDOR`).
4. Creates the `User`, its `UserRole`, and an empty `Profile`.
5. Issues an access token + refresh token and returns them with the sanitized user object.

### Login

`POST /api/v1/auth/login`:

1. Looks up the user by email (loading roles).
2. Rejects suspended and inactive accounts.
3. Verifies the password with `bcrypt.compare`.
4. Updates `lastLoginAt`.
5. Returns the user, `accessToken`, and `refreshToken`.

### Token Refresh

`POST /api/v1/auth/refresh` with `{ "refreshToken": "<jwt>" }`:

1. Verifies the refresh token with the refresh secret.
2. Loads the user; rejects if inactive or suspended.
3. Returns a **new** access token and a **rotated** refresh token.

Refresh rotation means every refresh invalidates the previous token client-side, limiting the reuse window of a stolen refresh token.

### Logout

`POST /api/v1/auth/logout` requires a valid access token. The API confirms the logout; the client clears tokens from the Zustand store (persisted to `localStorage`). Token revocation is client-side; with JWTs, server-side invalidation is achieved through the short access-token lifetime and user suspension/account state checks.

## Token Design

| Token | Lifetime | Payload | Secret |
| --- | --- | --- | --- |
| Access | `15m` (config `JWT_EXPIRES_IN`) | `{ userId, email, roles }` | `JWT_SECRET` |
| Refresh | `7d` (config `JWT_REFRESH_EXPIRES_IN`) | `{ userId }` | `JWT_REFRESH_SECRET` |

- Tokens are signed with `jsonwebtoken`; secrets come from environment variables (see `.env.example`). The development defaults must be changed in production.
- The access token carries the role list at issuance time, so role changes take effect after the next token refresh.
- The refresh token intentionally contains only the `userId` and is bound to the user by a fresh database check on every use.

## Roles

Roles are data-driven via the `Role`/`UserRole` tables and seeded by `backend/src/prisma/seed/index.ts`. Users can hold multiple roles.

| Role | Description |
| --- | --- |
| `STUDENT` | Default role; marketplace/community access. |
| `SERVICE_PROVIDER` | Offers services to the community. |
| `LANDLORD` | Lists accommodation. |
| `VENDOR` | Business or vendor selling products. |
| `ADMIN` | Platform administrator; sole role allowed on `/api/v1/admin/*`. |

## Middleware

Defined in `backend/src/middleware/auth.ts`.

### `authenticate`

Requires `Authorization: Bearer <accessToken>`. Verifies the token and attaches `req.user = { userId, email, roles }`. Failure produces a `401 UnauthorizedError`.

### `optionalAuth`

Runs only if a Bearer token is present; attaches `req.user` when valid, otherwise continues as anonymous. Used on public listing/detail/search endpoints so responses can include viewer-specific data (e.g. `isFavorited`) without blocking guests.

### `authorize(...roles)`

Guard factory used after `authenticate`. Returns `403 ForbiddenError('Insufficient permissions')` unless the decoded roles intersect `allowedRoles`. Applied chain-style:

```ts
router.use(authenticate, authorize('ADMIN'));
```

which is how the entire admin route group is protected.

### `requireVerified`

Post-auth check that the account exists, is not suspended, and has `isEmailVerified`; otherwise `403`.

## Protected Routes

Everything under `GET/POST/PUT/DELETE /api/v1/favorites`, `/messages`, `/notifications`, `/payments`, and `/admin` requires authentication, as do the owner-scoped write operations on `/marketplace`, `/services`, and `/accommodation` (see [API reference](api.md)). Write access is additionally ownership-checked in service methods (e.g. `Not your listing` → `403 ForbiddenError`).

## Frontend Integration

- `frontend/src/lib/api.ts` attaches the access token via an Axios request interceptor.
- A response interceptor transparently refreshes on `401`: it calls `/auth/refresh` with the stored refresh token, rotates both tokens through the Zustand store, and retries the original request once. Auth endpoints are excluded from the retry loop to avoid refresh loops.
- `frontend/src/store/auth.ts` persists `{ user, accessToken, refreshToken }` to `localStorage` under `cavconnect-auth` and exposes `setAuth`, `setTokens`, `logout`, `hasRole`, and `isAdmin`.
- UI access is enforced by role helpers and by the server's `authorize` guards — server-side checks are authoritative.

## Password Rules

- Minimum 8 characters (validated on register and change-password).
- Stored only as a bcrypt hash (12 rounds); the plaintext is never logged or returned.
- `change-password` requires the current password to be verified before replacing the hash.

## Security Notes

- **Rate limiting on auth** — `POST /auth/login` and `/register` allow only 20 requests/15 min per IP (`backend/src/app.ts`), mitigating credential stuffing and brute force.
- **Sequential verification** — login objects the same `Invalid email or password` for both unknown email and wrong password to avoid account enumeration.
- **Suspension wins** — suspended or inactive accounts are rejected at login **and** at token refresh.
- **Short-lived access tokens** limit the damage window of a leaked token.
- **Secrets in env only** — `JWT_SECRET`, `JWT_REFRESH_SECRET`, and `DATABASE_URL` are environment variables; the repository ships `.env.example` (ignored `.env` files via `.gitignore`).
- **Never share tokens** — refresh tokens must be stored client-side and transmitted only in the request body over HTTPS in production.