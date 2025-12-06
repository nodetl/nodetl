# =============================================================================
# ALL-IN-ONE Dockerfile: Backend (Go) + Frontend (React) + MongoDB
# Single Docker image containing everything
# =============================================================================
# Build:  docker build -t nodetl:latest .
# Run:    docker run -d -p 8602:80 -v nodetl_data:/data/db nodetl:latest
# Access: http://localhost:8602
# =============================================================================

# Stage 1: Build Backend
FROM golang:1.25-alpine AS backend-builder
WORKDIR /build
RUN apk add --no-cache git
COPY src/backend/go.mod src/backend/go.sum ./
RUN go mod download
COPY src/backend/ .
RUN CGO_ENABLED=0 GOOS=linux go build -o server ./cmd/server

# Stage 2: Build Frontend
FROM node:25-alpine3.19 AS frontend-builder
WORKDIR /build
# Ensure distro packages are updated so known vulnerabilities are patched
RUN apk update && apk upgrade --available --no-cache
COPY src/frontend/package*.json ./
RUN npm ci --silent
COPY src/frontend/ .
RUN npm run build

# Stage 3: Final Runtime Image (Ubuntu-based for better MongoDB ARM64 support)
FROM ubuntu:22.04

ENV DEBIAN_FRONTEND=noninteractive

# Install dependencies + MongoDB
RUN apt-get update && apt-get install -y \
    curl gnupg ca-certificates nginx supervisor \
    && curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg --dearmor -o /usr/share/keyrings/mongodb.gpg \
    && echo "deb [arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb.gpg] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse" > /etc/apt/sources.list.d/mongodb-org-7.0.list \
    && apt-get update && apt-get install -y mongodb-org \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Create directories
RUN mkdir -p /data/db /var/log/supervisor /run/nginx /app

# Copy backend binary
COPY --from=backend-builder /build/server /app/server

# Copy frontend build
COPY --from=frontend-builder /build/dist /var/www/html

# Copy Nginx config
COPY config/nginx/default.conf /etc/nginx/sites-available/default

# Copy Supervisor config
COPY config/supervisor/supervisord.conf /etc/supervisor/conf.d/all.conf

# Expose single port (frontend serves everything)
EXPOSE 80

# Volume for data persistence
VOLUME ["/data/db"]

# Healthcheck
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s \
    CMD curl -sf http://127.0.0.1/health || exit 1

# Start all services
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/supervisord.conf"]
