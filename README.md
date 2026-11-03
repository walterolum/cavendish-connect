# CAV CONNECT

**Connect. Buy. Sell. Serve. Find.**

CAV CONNECT is a full-stack marketplace and community platform built for the Cavendish University Uganda community. It lets students and local businesses buy and sell products, advertise and find services, list and discover accommodation, message each other, leave reviews, and manage their presence through a single account — delivered as a installable, mobile-first Progressive Web App (PWA).

## Features

- **Marketplace** — Post products for sale with photos, price, condition, negotiability, quantity, and location. Listings are moderated and go through a `PENDING_REVIEW` → `ACTIVE` workflow before going public.
- **Services** — Students and service providers can offer skills (design, tutoring, development, event services and more) with portfolio items, price ranges, and availability.
- **Accommodation** — Landlords list hostels, single/shared rooms, apartments, houses and bedsitters with monthly price, deposit, room counts, proximity to campus, and amenities.
- **Messaging** — Direct, private conversations between users with read/unread tracking and unread counts.
- **Reviews & ratings** — 1–5 star reviews against sellers, service providers, landlords, and businesses, with average rating aggregation.
- **Favorites** — Save marketplace listings, services, and properties to a personal favorites list.
- **Reports & moderation** — First-class report model (scam, fraud, fake product, harassment, etc.) managed through the admin moderation console.
- **Notifications** — In-app notification feed covering new messages, listing approval/rejection, verification status, promotion activation, and report updates.
- **Admin dashboard** — Platform statistics, user management (suspend/activate/role change), listing moderation, report resolution, verification reviews, configurable settings, and audit log browsing.
- **Promotions & payments** — Featured, premium, sponsored, and business-plan promotions purchased against database-defined plans and prices; payment records with a provider-agnostic abstraction (UGX primary currency).
- **PWA** — Installable standalone app with offline-capable runtime caching for the API and images, auto-updating service worker.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React 19, Vite, Tailwind CSS v4, React Router v7, TanStack Query v5, Zustand, React Hook Form + Zod, Axios, Framer Motion, Sonner |
| PWA | vite-plugin-pwa (Workbox, auto-update, API/images runtime caching) |
| Backend | Node.js, Express 5, TypeScript, Prisma ORM, MySQL |
| Auth | JWT (access 15m / refresh 7d), bcryptjs (12 rounds), role-based access control |
| Security | Helmet, CORS, express-rate-limit, express-validator, hpp, multipart upload validation (Multer) |
| Tooling | npm workspaces (monorepo), TypeScript, oxlint (frontend lint), morgan, compression |

## Project Structure

```
cav-connect/
├── backend/                 # Node.js + Express + TypeScript + Prisma API
│   ├── prisma/
│   │   ├── schema.prisma    # Database schema (MySQL)
│   │   └── migrations/      # Generated migrations
│   └── src/
│       ├── app.ts           # Express app & middleware chain
│       ├── config/          # Env config + Prisma client
│       ├── controllers/     # HTTP layer
│       ├── services/        # Business logic
│       ├── routes/          # Route definitions & validators
│       ├── middleware/      # auth, upload, validate, audit, errorHandler
│       ├── utils/           # errors, response envelope, JWT/bcrypt helpers
│       ├── prisma/seed/     # Seed script & demo data
│       └── integrations/    # Reserved (email, storage, payment gateways)
├── frontend/                # React + Vite + Tailwind + PWA SPA
│   └── src/
│       ├── pages/           # Route-level screens (feature-based folders)
│       ├── components/      # layout/, listing/, ui/ primitives
│       ├── lib/             # Axios client, utils
│       ├── services/        # Typed API service modules
│       ├── store/           # Zustand stores (auth)
│       └── routes/          # AppRoutes, scroll-to-top
├── docs/                    # Architecture, API, DB, security, ops docs
└── package.json             # npm workspaces root
```

## Quick Start

### Prerequisites

- Node.js 18+ and npm
- MySQL 8+ running locally (or via Docker)
- Backend environment: `DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET`

### Setup

```bash
# 1. Clone the repository and install dependencies
git clone <repository-url>
cd cav-connect
npm install

# 2. Configure the backend environment
cd backend
cp .env.example .env
#   - Edit .env: set DATABASE_URL, JWT secrets, CORS origin

# 3. Create the database, generate client, run migrations
cd ..
npm run migrate

# 4. Seed roles, demo users, categories, amenities, and system settings
npm run seed

# 5. Start development servers (API on http://localhost:5000, web on http://localhost:5173)
npm run dev
```

The Vite dev server proxies `/api` and `/uploads` to the backend at `http://localhost:5000`, so the frontend works without additional configuration.

## Demo Credentials

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@cavconnect.com` | `Admin@12345` |
| Student | `student1@cavconnect.com` | `Student@12345` |
| Student | `student2@cavconnect.com` | `Student@12345` |
| Student | `student3@cavconnect.com` | `Student@12345` |

## Available Scripts

Run at the repo root with npm workspaces:

| Script | Description |
| --- | --- |
| `npm run dev` | Start backend and frontend dev servers concurrently |
| `npm run dev:backend` | Start only the backend (`ts-node` + nodemon, port 5000) |
| `npm run dev:frontend` | Start only the Vite frontend (port 5173) |
| `npm run build` | Build backend (`tsc`) and frontend (`tsc -b && vite build`) |
| `npm run build:backend` | Compile backend to `dist/` |
| `npm run build:frontend` | Build the frontend production bundle (incl. PWA) |
| `npm run migrate` | Run Prisma migrations (`migrate dev`) |
| `npm run seed` | Seed roles, demo users, categories, amenities, settings |
| `npm run studio` | Open Prisma Studio against the database |

Backend workspace (`npm run <script> --workspace backend`): `dev`, `build`, `start` (`node dist/app.js`), `prisma:generate`, `prisma:migrate`, `prisma:migrate:prod` (`migrate deploy`), `prisma:seed`, `prisma:studio`, `test`.

## Documentation

- [Architecture](docs/architecture.md)
- [Database schema](docs/database.md)
- [REST API](docs/api.md)
- [Authentication](docs/authentication.md)
- [Deployment](docs/deployment.md)
- [Security](docs/security.md)
- [Testing](docs/testing.md)
- [Business model](docs/business-model.md)
- [Database backups](docs/backups.md)

## License

MIT. Built for Cavendish University Uganda.