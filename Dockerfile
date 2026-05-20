# Multi-stage Docker build for maximum performance and security
FROM node:22-alpine AS builder

WORKDIR /app

# Cache dependency installations
COPY package.json package-lock.json ./
RUN npm ci

# Copy app source files and compile both client (Vite) and backend (esbuild)
COPY . .
RUN npm run build

# Thin runner stage
FROM node:22-alpine AS runner

WORKDIR /app

# Enable standard production configuration
ENV NODE_ENV=production
ENV PORT=8000

# Install ONLY production dependencies to keep the image compact
COPY package.json package-lock.json ./
RUN npm ci --only=production

# Retrieve compiled bundles from builder stage
COPY --from=builder /app/dist ./dist

# Copy seed database if it exists
COPY --from=builder /app/nexus_db.json* ./

# Expose server traffic port
EXPOSE 8000

# Standalone start command
CMD ["npm", "run", "start"]
