# syntax=docker/dockerfile:1

# ============================================================================
# LOKI HORO — production image (multi-stage)
#
# Stage 1 (builder): install ALL deps and run the build (Vite client bundle +
#   esbuild server bundle -> dist/index.cjs). The build script uses tsx/esbuild
#   which are devDependencies, so we need the full dependency set here.
#
# Stage 2 (runtime): a slim image with ONLY production deps. We run
#   `npm ci --omit=dev` here so native modules (better-sqlite3) are compiled
#   against THIS image's Node/ABI + architecture — never copied from the
#   builder. Then we copy the built dist/ from the builder.
# ============================================================================

# ---- Stage 1: build ---------------------------------------------------------
FROM node:20-bookworm AS builder

WORKDIR /app

# Native build toolchain for better-sqlite3 (node-gyp needs python3 + make + g++).
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install all deps (incl. dev) with a reproducible lockfile install.
COPY package.json package-lock.json ./
RUN npm ci

# Copy the source and build both client + server bundles.
COPY . .
RUN npm run build

# ---- Stage 2: runtime -------------------------------------------------------
FROM node:20-bookworm-slim AS runtime

ENV NODE_ENV=production
WORKDIR /app

# Toolchain needed to compile better-sqlite3's native binding for THIS image.
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

# Install production deps only. This compiles better-sqlite3 for the runtime
# image's architecture + Node ABI, so the native binding always matches.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev \
    && npm cache clean --force

# Bring in the compiled application (client assets + server bundle).
COPY --from=builder /app/dist ./dist

# The app persists its SQLite DB + sessions here. Mount a volume at /data and
# set DB_PATH=/data/data.db (see docker-compose.yml) so data survives restarts.
RUN mkdir -p /data
ENV DB_PATH=/data/data.db
ENV PORT=5000

EXPOSE 5000

# server/index.ts binds 0.0.0.0:${PORT}. serveStatic() serves dist/public.
CMD ["node", "dist/index.cjs"]
