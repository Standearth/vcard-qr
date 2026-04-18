# Stage 1: Builder
FROM node:24-slim AS builder
WORKDIR /app

RUN npm install -g pnpm

COPY . .
RUN pnpm install
RUN pnpm --filter headless-api build

RUN pnpm deploy --filter headless-api --prod --legacy /prod/headless-api

# Stage 2: Production
FROM node:24-slim
WORKDIR /app

# Install shared libraries required by Chromium
RUN apt-get update \
    && apt-get install -y \
    libnss3 libxss1 libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \
    libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 libgdk-pixbuf2.0-0 \
    libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 libpangocairo-1.0-0 \
    libstdc++6 libx11-6 libx11-xcb1 libxcb1 libxcomposite1 libxcursor1 \
    libxdamage1 libxext6 libxfixes3 libxi6 libxrandr2 libxrender1 \
    libxshmfence1 libxtst6 \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

# Copy the isolated production API package
COPY --from=builder /prod/headless-api ./

# Copy the built frontend into the container so Express can serve it
COPY --from=builder /app/frontend/dist ./frontend-dist

# Set NODE_ENV to trigger the Sparticuz logic
ENV NODE_ENV=production

EXPOSE 8080
CMD [ "node", "dist/index.js" ]