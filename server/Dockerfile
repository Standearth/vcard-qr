# Stage 1: Builder
# This stage builds the entire monorepo to get the compiled server code.
FROM node:24-slim AS builder
WORKDIR /app

# Copy all package manifests
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY frontend/package.json ./frontend/
COPY packages/shared-utils/package.json ./packages/shared-utils/

# Install all monorepo dependencies
RUN npm install

# Copy source code for server and shared packages
COPY server/ ./server/
COPY packages/shared-utils/ ./packages/shared-utils/

# Build the server
RUN npm run build -w server


# Stage 2: Production
# This stage creates a lean image with only the server's production code.
FROM node:24-slim
WORKDIR /app

# Copy only the server's production dependencies manifest
COPY server/package.json server/package-lock.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy compiled code and assets from the builder stage
COPY --from=builder /app/server/dist ./dist
COPY --from=builder /app/server/models ./models
COPY --from=builder /app/server/certs/AppleWWDRCAG4.pem ./certs/AppleWWDRCAG4.pem

# Expose port and start the server
EXPOSE 3000
CMD [ "node", "dist/index.js" ]