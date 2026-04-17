# Stage 1: Builder
FROM node:24-slim AS builder
WORKDIR /app

RUN npm install -g pnpm

# Copy the entire monorepo
COPY . .

# Install dependencies and build
RUN pnpm install
RUN pnpm --filter server... build

# Isolate the server package into a clean, production-ready folder
RUN pnpm deploy --filter server --prod --legacy /prod/server

# Stage 2: Production
FROM node:24-slim
WORKDIR /app

# Copy the isolated production package
COPY --from=builder /prod/server ./

# Ensure certs directory exists and copy the WWDR cert
RUN mkdir -p ./certs
COPY --from=builder /app/server/certs/AppleWWDRCAG4.pem ./certs/AppleWWDRCAG4.pem

EXPOSE 3000
CMD [ "node", "dist/index.js" ]