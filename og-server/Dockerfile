# ── Stage 1: Build the Vite SPA ──────────────────────────────────────────────
#
# Identical to the original Dockerfile build stage. Produces /app/dist.

FROM node:22-alpine AS build

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --prefer-offline
COPY . .

ARG VITE_API_BASE_URL
ARG VITE_SCAN_BASE_URL
ARG VITE_WS_BASE_URL
ARG VITE_KEYCLOAK_URL
ARG VITE_KEYCLOAK_REALM=scanny
ARG VITE_KEYCLOAK_CLIENT_ID=scanny-client
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_SCAN_BASE_URL=$VITE_SCAN_BASE_URL \
    VITE_WS_BASE_URL=$VITE_WS_BASE_URL \
    VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL \
    VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM \
    VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

RUN npm run build

# ── Stage 2: Install og-server dependencies ───────────────────────────────────
#
# Separate stage so the final image doesn't carry the full SPA build toolchain.

FROM node:22-alpine AS server-deps

WORKDIR /server
COPY og-server/package.json ./
# --omit=dev is the default for NODE_ENV=production but we set it explicitly.
RUN npm install --omit=dev --prefer-offline

# ── Stage 3: Runtime ──────────────────────────────────────────────────────────
#
# Minimal Node 22 Alpine image:
#   /app/dist        — Vite-built SPA (copied from build stage)
#   /app/server.mjs  — OG middleware server
#   /app/node_modules — express + dependencies (copied from server-deps stage)

FROM node:22-alpine AS runtime

# Run as non-root for security parity with the previous nginx:alpine runtime.
RUN addgroup -S kode && adduser -S -G kode kode

WORKDIR /app

# Copy the Vite build output
COPY --from=build  --chown=kode:kode /app/dist       ./dist

# Copy the og-server source and its installed node_modules
COPY --from=server-deps --chown=kode:kode /server/node_modules ./node_modules
COPY --chown=kode:kode og-server/server.mjs ./server.mjs

USER kode

ENV NODE_ENV=production \
    PORT=3000 \
    STATIC_DIR=/app/dist

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:3000/health || exit 1

CMD ["node", "server.mjs"]
