# Stage 1: Builder
FROM node:24-slim AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy all package manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY frontend/package.json ./frontend/
COPY packages/shared-utils/package.json ./packages/shared-utils/

# Install all monorepo dependencies
RUN pnpm install

# Copy source code for server and shared packages
COPY server/ ./server/
COPY packages/shared-utils/ ./packages/shared-utils/

# Build the server
RUN pnpm --filter server build

# Prune development dependencies from the entire workspace
RUN pnpm prune --prod


# Stage 2: Production
FROM node:24-slim
WORKDIR /app

# Copy production node_modules and relevant package.json files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/packages/shared-utils/node_modules ./packages/shared-utils/node_modules
COPY --from=builder /app/server/package.json ./server/package.json
COPY --from=builder /app/packages/shared-utils/package.json ./packages/shared-utils/package.json

# Copy compiled code and assets from the builder stage
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/models ./server/models
COPY --from=builder /app/server/certs/AppleWWDRCAG4.pem ./server/certs/AppleWWDRCAG4.pem

# Expose port and start the server
EXPOSE 3000
CMD [ "node", "server/dist/index.js" ]