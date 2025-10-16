# Stage 1: Base image with better caching
FROM node:23.3.0-slim AS base
RUN npm install -g pnpm@10.12.4

# Install system dependencies in a separate layer for better caching
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    g++ \
    python3 \
    python3-pip \
    python3-setuptools \
    python3-wheel \
    libsqlite3-dev \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Stage 2: Dependencies installation
FROM base AS deps
WORKDIR /app

# Copy package files first for better layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json ./
COPY packages/core/package.json packages/core/tsconfig.json packages/core/tsup.config.ts ./packages/core/
COPY packages/client-instagram/package.json ./packages/client-instagram/
COPY packages/plugin-twitter/package.json ./packages/plugin-twitter/
COPY packages/plugin-shared-email-sanity/package.json ./packages/plugin-shared-email-sanity/
COPY packages/adapter-sqlite/package.json ./packages/adapter-sqlite/
COPY packages/client-telegram/package.json ./packages/client-telegram/
COPY packages/plugin-tee/package.json ./packages/plugin-tee/
COPY packages/plugin-bootstrap/package.json ./packages/plugin-bootstrap/
COPY packages/plugin-email/package.json ./packages/plugin-email/
COPY packages/plugin-sanity/package.json ./packages/plugin-sanity/
COPY packages/client-direct/package.json ./packages/client-direct/
COPY packages/dynamic-imports/package.json ./packages/dynamic-imports/
COPY packages/plugin-zkproof/package.json ./packages/plugin-zkproof/
COPY packages/plugin-chipi/package.json ./packages/plugin-chipi/
COPY packages/plugin-chipi-client/package.json ./packages/plugin-chipi-client/
COPY packages/plugin-starknet/package.json ./packages/plugin-starknet/
COPY agent/package.json ./agent/
COPY .env ./.env

# Install dependencies with persistent cache
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    --mount=type=cache,target=/root/.cache/pnpm \
    pnpm install --no-frozen-lockfile --filter=!client

# Stage 3: Builder stage
FROM deps AS builder
WORKDIR /app

# Copy source code after dependencies are installed
COPY . .

# Create .dockerignore optimized build
RUN pnpm run build --filter=!client

# Prune dev dependencies
RUN pnpm prune --prod

# Stage 4: Runtime stage
FROM node:23.3.0-slim AS runtime
WORKDIR /app

# Install only runtime system dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    sqlite3 \
    nano \
    && rm -rf /var/lib/apt/lists/* \
    && apt-get clean

# Install pnpm for runtime
RUN npm install -g pnpm@10.12.4

# Create non-root user and set permissions
RUN useradd -m nonroot && \
    mkdir -p /app/data /app/agent/characters/knowledge && \
    chown -R nonroot:nonroot /app /app/data /app/agent/characters/knowledge && \
    chmod 775 /app/data /app/agent/characters/knowledge

USER nonroot

# Copy built application
COPY --from=builder --chown=nonroot:nonroot /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml /app/.npmrc /app/turbo.json ./
COPY --from=builder --chown=nonroot:nonroot /app/packages ./packages/
COPY --from=builder --chown=nonroot:nonroot /app/agent ./agent/
COPY --from=builder --chown=nonroot:nonroot /app/node_modules ./node_modules/

EXPOSE 3000
CMD ["node", "agent/dist/index.js"]