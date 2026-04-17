# Stage 1: Builder
FROM node:24-slim AS builder
WORKDIR /app

RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY headless-api/package.json ./headless-api/
RUN pnpm install --filter headless-api...

COPY headless-api/ ./headless-api/
COPY tsconfig.base.json ./
RUN pnpm --filter headless-api build
RUN pnpm prune --prod

# Stage 2: Production
FROM node:24-slim
WORKDIR /app

# Install Chromium and its dependencies
RUN apt-get update \
    && apt-get install -y chromium \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Tell Puppeteer where to find the installed Chromium
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/headless-api/node_modules ./headless-api/node_modules
COPY --from=builder /app/headless-api/package.json ./headless-api/
COPY --from=builder /app/headless-api/dist ./headless-api/dist

EXPOSE 8080
CMD [ "node", "headless-api/dist/index.js" ]
