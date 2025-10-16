# Stage 1: Base image
FROM node:23.3.0-slim AS base
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    python3 \
    python3-pip \
    python3-venv \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/* \
    && ln -s /usr/bin/python3 /usr/bin/python

ENV PYTHON=/usr/bin/python3
RUN npm install -g pnpm@10.12.4

# Stage 2: Dependencies installation
FROM base AS deps
WORKDIR /app

# Copy package files first for better caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json lerna.json ./
COPY client/package.json client/pnpm-lock.yaml ./client/
COPY client/tsconfig.json ./client/
COPY .env ./.env
COPY packages/core/package.json ./packages/core/
COPY packages/adapter-sqlite/package.json ./packages/adapter-sqlite/
COPY packages/plugin-zkproof/package.json ./packages/plugin-zkproof/
COPY packages/plugin-chipi/package.json ./packages/plugin-chipi/
COPY packages/plugin-chipi-client/package.json ./packages/plugin-chipi-client/


# Install dependencies with cache
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    --mount=type=cache,target=/root/.cache/pnpm \
    pnpm install --no-frozen-lockfile --filter=client --filter=@elizaos/core

# Add additional dev dependencies
RUN pnpm add -D @types/react-router-dom@^5.3.3 --filter=client

# Stage 3: Builder stage
FROM deps AS builder
WORKDIR /app

# Copy source code after dependencies
COPY client ./client
COPY packages/core ./packages/core
COPY packages/adapter-sqlite ./packages/adapter-sqlite
COPY packages/plugin-zkproof ./packages/plugin-zkproof
COPY packages/plugin-chipi ./packages/plugin-chipi
COPY packages/plugin-chipi-client ./packages/plugin-chipi-client

# Build packages in dependency order
RUN pnpm --filter=@elizaos/core build
RUN pnpm --filter=client build

# Stage 4: Runtime stage
FROM nginx:alpine AS runtime
WORKDIR /app

# Copy built static files
COPY --from=builder /app/client/dist /usr/share/nginx/html

# Copy Nginx configuration
COPY client/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]