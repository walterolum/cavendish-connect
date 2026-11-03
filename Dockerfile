# Cavendish Connect: one container that serves the website, the API and uploaded photos.

# ---- Build ----
FROM node:22-bookworm-slim AS build
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app

# Install dependencies first so they are cached between deploys.
COPY package.json package-lock.json ./
COPY backend/package.json backend/
COPY frontend/package.json frontend/
COPY scripts/fix-native-deps.mjs scripts/
RUN npm ci --no-audit --no-fund && node scripts/fix-native-deps.mjs

COPY backend backend
COPY frontend frontend
RUN cd backend && npx prisma generate
RUN npm run build

# ---- Run ----
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app

EXPOSE 5000
# Applies database updates, makes sure categories/settings/admin exist, then starts.
CMD ["npm", "run", "start:prod", "--workspace", "backend"]
