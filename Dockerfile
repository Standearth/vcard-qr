# Stage 1: Build the application
FROM node:24-slim AS builder

# Set the working directory inside the container
WORKDIR /usr/src/app

# Copy dependency manifests. These paths are relative to the `./server` context.
COPY package*.json ./

# Install all dependencies (including devDependencies like TypeScript)
RUN npm install

# Copy the rest of the source code from the `./server` context
COPY . .

# Run the build script to compile TypeScript to JavaScript
RUN npm run build

# ---

# Stage 2: Create the final production image
FROM node:24-slim

# Set the working directory
WORKDIR /usr/src/app

# Copy the production dependency manifest
COPY package*.json ./

# Install only production dependencies
RUN npm install --only=production

# Copy the compiled code from the 'builder' stage
COPY --from=builder /usr/src/app/dist ./dist

# Copy the Apple Wallet template models needed at runtime
COPY --from=builder /usr/src/app/models ./models

# Command to run the application
CMD [ "npm", "start" ]