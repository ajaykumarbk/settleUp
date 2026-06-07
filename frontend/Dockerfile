# ========================================
# Frontend Optimized Multi-Stage Dockerfile
# Node Build & Nginx Production Server
# ========================================

ARG NODE_VERSION=24.11.1-alpine
FROM node:${NODE_VERSION} AS build

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies with build optimizations
RUN --mount=type=cache,target=/root/.npm,sharing=locked \
    npm ci --no-audit --no-fund && \
    npm cache clean --force

# Copy frontend source files
COPY . .

# Build React application to produce dist directory
RUN npm run build

# ========================================
# Nginx Production Server Stage
# ========================================
FROM nginx:1.27.3-alpine AS production

# Set working directory inside Nginx
WORKDIR /usr/share/nginx/html

# Copy built frontend assets from build stage
COPY --from=build /app/dist .

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port
EXPOSE 80

# Start Nginx in the foreground
CMD ["nginx", "-g", "daemon off;"]
