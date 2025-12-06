# Deployment Guide

This guide covers different deployment options for NodeTL.

## Table of Contents

1. [Docker (Recommended)](#docker-recommended)
2. [All-in-One Docker Image](#all-in-one-docker-image)
3. [Manual Deployment](#manual-deployment)
4. [Production Considerations](#production-considerations)

---

## Docker (Recommended)

The recommended way to deploy NodeTL is using Docker Compose, which runs each service in separate containers.

### Prerequisites

- Docker 24.0+
- Docker Compose 2.0+
- At least 2GB RAM
- At least 10GB disk space

### Quick Start

```bash
# Clone the repository
git clone https://github.com/yourusername/nodetl.git
cd nodetl

# Start all services
docker compose up -d

# Check status
docker compose ps

# View logs
docker compose logs -f
```

### Services

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 8602 | React application (Nginx) |
| Backend | 8603 | Go API server |
| MongoDB | 27017 | Database |

### Accessing the Application

- **Frontend:** http://localhost:8602
- **Backend API:** http://localhost:8603/api/v1
- **MongoDB:** mongodb://localhost:27017

### Stopping Services

```bash
docker compose down

# To also remove volumes (data)
docker compose down -v
```

---

## All-in-One Docker Image

For simpler deployments, you can use a single Docker image that contains everything.

### Build the Image

```bash
docker build -f Dockerfile -t nodetl:latest .
```

### Run the Container

```bash
docker run -d \
  --name nodetl \
  -p 8602:80 \
  -v nodetl_data:/data/db \
  nodetl:latest
```

### Access

- **Application:** <http://localhost:8602>

### Container Management

```bash
# View logs
docker logs nodetl
docker logs -f nodetl  # Follow logs

# Stop container
docker stop nodetl

# Start container
docker start nodetl

# Remove container
docker rm -f nodetl

# Shell into container
docker exec -it nodetl bash
```

---

## Manual Deployment

For development or custom deployments, you can run each component manually.

### Prerequisites

- Go 1.21+
- Node.js 20+
- MongoDB 7.0+

### Step 1: Start MongoDB

```bash
# Using Docker
docker run -d -p 27017:27017 --name mongo mongo:7.0

# Or install locally
# See: https://docs.mongodb.com/manual/installation/
```

### Step 2: Build and Run Backend

```bash
cd src/backend

# Create environment file
cat > .env << EOF
SERVER_PORT=8080
SERVER_MODE=debug
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=nodetl
LOG_LEVEL=info
LOG_FORMAT=json
EOF

# Install dependencies
go mod download

# Build
go build -o nodetl ./cmd/server

# Run
./nodetl
```

### Step 3: Build and Run Frontend

```bash
cd src/frontend

# Install dependencies
npm install

# For development
npm run dev

# For production
npm run build
# Then serve the dist folder with a web server
```

---

## Production Considerations

### Environment Variables

| Variable | Production Value | Description |
|----------|-----------------|-------------|
| SERVER_MODE | `release` | Disables debug logging |
| LOG_LEVEL | `info` or `warn` | Reduces log verbosity |
| LOG_FORMAT | `json` | Structured logging |

### Security

1. **Enable HTTPS**
   - Use a reverse proxy (Nginx, Traefik, Caddy)
   - Obtain SSL certificates (Let's Encrypt)

2. **MongoDB Security**
   - Enable authentication
   - Use strong passwords
   - Restrict network access

3. **API Security** (Coming soon)
   - API key authentication
   - Rate limiting
   - CORS configuration

### Reverse Proxy Example (Nginx)

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api/ {
        proxy_pass http://localhost:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Backup and Restore

#### MongoDB Backup

```bash
# Create backup
docker exec workflow-mongodb mongodump \
  --db nodetl \
  --out /dump

docker cp workflow-mongodb:/dump ./backup

# Restore backup
docker cp ./backup workflow-mongodb:/dump

docker exec workflow-mongodb mongorestore \
  --db nodetl \
  /dump/nodetl
```

### Scaling

For high availability:

1. **MongoDB**: Use a replica set
2. **Backend**: Run multiple instances behind a load balancer
3. **Frontend**: Serve from CDN

### Monitoring

Recommended tools:

- **Metrics**: Prometheus + Grafana
- **Logs**: ELK Stack or Loki
- **Tracing**: Jaeger or Zipkin

---

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs nodetl

# Check if port is in use
netstat -tlnp | grep :80
```

### MongoDB connection issues

```bash
# Test connection
mongosh mongodb://localhost:27017

# Check if MongoDB is running
docker ps | grep mongo
```

### Frontend can't reach backend

- Check CORS settings
- Verify API URL configuration
- Check network connectivity

### Out of disk space

```bash
# Clean up Docker
docker system prune -a
docker volume prune
```
