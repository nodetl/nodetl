.PHONY: all build run test clean docker-up docker-down dev help

# ============================================================================
# NodeTL - Build Automation
# ============================================================================

# Go parameters
GOCMD=go
GOBUILD=$(GOCMD) build
GOCLEAN=$(GOCMD) clean
GOTEST=$(GOCMD) test
GOMOD=$(GOCMD) mod

# Directories
BACKEND_DIR=src/backend
FRONTEND_DIR=src/frontend

# Binary
BINARY_NAME=nodetl

# Colors for terminal output
GREEN=\033[0;32m
YELLOW=\033[0;33m
BLUE=\033[0;34m
NC=\033[0m # No Color

# ============================================================================
# Main Targets
# ============================================================================

help: ## Show this help message
	@echo "$(BLUE)NodeTL - Available Commands$(NC)"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(GREEN)%-20s$(NC) %s\n", $$1, $$2}'
	@echo ""

all: deps build ## Install dependencies and build

# ============================================================================
# Backend Targets
# ============================================================================

deps: ## Download backend dependencies
	@echo "$(YELLOW)Downloading backend dependencies...$(NC)"
	cd $(BACKEND_DIR) && $(GOMOD) download
	@echo "$(GREEN)✓ Dependencies downloaded$(NC)"

build: ## Build backend binary
	@echo "$(YELLOW)Building backend...$(NC)"
	cd $(BACKEND_DIR) && $(GOBUILD) -o $(BINARY_NAME) -v ./cmd/server
	@echo "$(GREEN)✓ Backend built: $(BACKEND_DIR)/$(BINARY_NAME)$(NC)"

run: build ## Build and run backend
	@echo "$(YELLOW)Starting backend server...$(NC)"
	cd $(BACKEND_DIR) && ./$(BINARY_NAME)

test: ## Run backend tests
	@echo "$(YELLOW)Running backend tests...$(NC)"
	cd $(BACKEND_DIR) && $(GOTEST) -v ./...

test-coverage: ## Run tests with coverage
	@echo "$(YELLOW)Running tests with coverage...$(NC)"
	cd $(BACKEND_DIR) && $(GOTEST) -v -cover -coverprofile=coverage.out ./...
	cd $(BACKEND_DIR) && $(GOCMD) tool cover -html=coverage.out -o coverage.html
	@echo "$(GREEN)✓ Coverage report: $(BACKEND_DIR)/coverage.html$(NC)"

clean: ## Clean build artifacts
	@echo "$(YELLOW)Cleaning...$(NC)"
	cd $(BACKEND_DIR) && $(GOCLEAN)
	cd $(BACKEND_DIR) && rm -f $(BINARY_NAME)
	cd $(FRONTEND_DIR) && rm -rf dist node_modules/.cache
	@echo "$(GREEN)✓ Cleaned$(NC)"

# ============================================================================
# Frontend Targets
# ============================================================================

frontend-install: ## Install frontend dependencies
	@echo "$(YELLOW)Installing frontend dependencies...$(NC)"
	cd $(FRONTEND_DIR) && npm ci
	@echo "$(GREEN)✓ Frontend dependencies installed$(NC)"

frontend-build: ## Build frontend for production
	@echo "$(YELLOW)Building frontend...$(NC)"
	cd $(FRONTEND_DIR) && npm run build
	@echo "$(GREEN)✓ Frontend built: $(FRONTEND_DIR)/dist$(NC)"

# ============================================================================
# Development Targets
# ============================================================================

dev: ## Start all services in development mode
	@echo "$(BLUE)Starting development environment...$(NC)"
	docker compose up -d mongodb
	@echo "$(GREEN)✓ MongoDB started$(NC)"

dev-backend: ## Start backend in development mode
	@echo "$(YELLOW)Starting backend (development)...$(NC)"
	cd $(BACKEND_DIR) && go run ./cmd/server

dev-frontend: ## Start frontend in development mode
	@echo "$(YELLOW)Starting frontend (development)...$(NC)"
	cd $(FRONTEND_DIR) && npm run dev

# ============================================================================
# Docker Targets
# ============================================================================

docker-up: ## Start all services with Docker Compose
	docker compose up -d

docker-down: ## Stop all Docker services
	docker compose down

docker-logs: ## Show Docker logs
	docker compose logs -f

docker-build: ## Build Docker images
	docker compose build

docker-all-in-one: ## Build all-in-one Docker image
	docker build -f Dockerfile -t workflow-engine:latest .

docker-run: docker-all-in-one ## Build and run all-in-one container
	docker rm -f workflow-engine 2>/dev/null || true
	docker run -d -p 80:80 -v workflow_data:/data/db --name workflow-engine workflow-engine:latest
	@echo "Access: http://localhost"

# ============================================================================
# Database Targets
# ============================================================================

mongo-shell: ## Open MongoDB shell
	docker exec -it workflow-mongodb mongosh workflow_engine
