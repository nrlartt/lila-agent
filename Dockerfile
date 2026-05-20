# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS build

# Native modules (better-sqlite3) + avoid npm cache EBUSY on Railway/Nixpacks
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV CI=true
ENV NPM_CONFIG_CACHE=/tmp/npm-cache
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

# Install deps before full copy (better layer cache)
COPY package.json package-lock.json ./
COPY web/package.json web/package-lock.json ./web/

RUN npm ci && npm ci --prefix web

COPY . .

# Railway injects service variables at build time (VITE_* for web bundle)
RUN npm run build

# --- runtime ---
FROM node:22-bookworm-slim AS production

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

ENV NODE_ENV=production
ENV NPM_CONFIG_CACHE=/tmp/npm-cache
ENV NPM_CONFIG_FUND=false
ENV NPM_CONFIG_AUDIT=false

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY --from=build /app/web/dist ./web/dist

EXPOSE 3000

CMD ["node", "dist/index.js", "server"]
