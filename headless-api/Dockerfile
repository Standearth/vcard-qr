# Stage 1: Builder
FROM node:24-slim AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy the entire monorepo
COPY . .

# Install dependencies and build
RUN pnpm install
RUN pnpm --filter headless-api build

# Isolate the headless-api package into a clean, production-ready folder
RUN pnpm deploy --filter headless-api --prod --legacy /prod/headless-api

# Stage 2: Production
FROM node:24-slim
WORKDIR /app

# Install Chromium and its dependencies
RUN apt-get update \
    && apt-get install -y chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

# Copy the isolated production package
COPY --from=builder /prod/headless-api ./

EXPOSE 8080
CMD [ "node", "dist/index.js" ]