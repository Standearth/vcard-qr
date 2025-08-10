# Stage 1: Builder
# This stage builds the entire monorepo to get the compiled server code.
FROM node:24-slim AS builder
WORKDIR /app

# Install pnpm
RUN npm install -g pnpm

# Copy all package manifests and workspace configuration
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json ./server/
COPY packages/shared-utils/package.json ./packages/shared-utils/

# Install all monorepo dependencies
RUN pnpm install

# Copy source code for server, shared packages, and base tsconfig
COPY server/ ./server/
COPY packages/shared-utils/ ./packages/shared-utils/
COPY tsconfig.base.json ./

# Run the full recursive build to ensure correct order
RUN pnpm -r build

# Prune development dependencies from the entire workspace
RUN pnpm prune --prod


# Stage 2: Production
# This stage creates a lean image with only the server's production code.
FROM node:24-slim
WORKDIR /app

# Copy production node_modules and relevant package.json files from builder
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/server/node_modules ./server/node_modules
COPY --from=builder /app/packages/shared-utils/dist ./packages/shared-utils/dist
COPY --from=builder /app/server/package.json ./server/
COPY --from=builder /app/packages/shared-utils/package.json ./packages/shared-utils/

# Copy compiled code and assets from the builder stage
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/server/models ./server/models
COPY --from=builder /app/server/certs/AppleWWDRCAG4.pem ./server/certs/AppleWWDRCAG4.pem

# Expose port and start the server
EXPOSE 3000
CMD [ "node", "server/dist/index.js" ]