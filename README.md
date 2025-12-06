# 🔄 NodeTL

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Go Version](https://img.shields.io/badge/Go-1.21+-00ADD8?logo=go)](https://golang.org/)
[![React](https://img.shields.io/badge/React-18+-61DAFB?logo=react)](https://reactjs.org/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-47A248?logo=mongodb)](https://www.mongodb.com/)
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker)](https://www.docker.com/)

**NodeTL** is a powerful, visual **data mapping and transformation platform** for building ETL pipelines and automating data workflows. Design complex data mappings with an intuitive drag-and-drop interface, transform data between any schemas, and create automated integration workflows.

> 🎯 **Core Purpose**: Simplify data integration by providing a visual interface to map, transform, and route data between different systems and formats.

## 📸 Screenshots

### Dashboard

![Dashboard](./docs/images/dashboard.png)

### Visual Workflow Editor

![Workflow Editor](./docs/images/workflow-editor.png)

### Data Mapping & Transformation

![Mapping Editor](./docs/images/mapping-editor.png)

### Execution Logs

![Execution Logs](./docs/images/execution-logs.png)

### Tracing

![Tracing](./docs/images/tracing-screen.png)

### Settings

![Settings](./docs/images/settings.png)

## ✨ Features

### 🗺️ Data Mapping & Transformation (Core Feature)

- **Visual Schema Mapping** - Drag-and-drop interface to map fields between source and target schemas
- **Schema Management** - Define, store, and reuse data schemas across workflows
- **Field-level Transformations** - Apply transformations during mapping (type conversion, formatting, calculations)
- **Predefined Schema Templates** - Quick start with common data formats (JSON, XML, CSV structures)
- **Mapping Rules Engine** - Create complex mapping logic with conditions and expressions
- **Data Type Coercion** - Automatic and manual type conversion between incompatible fields
- **Nested Object Mapping** - Handle complex nested structures and arrays
- **AI-Assisted Mapping** - Generate test data and suggest mappings using AI

### 🔄 Workflow Automation

- 🎨 **Visual Workflow Designer** - Drag-and-drop interface built with React Flow
- 🔗 **Node-based Architecture** - Connect nodes to create complex data pipelines
- 🌐 **REST API Endpoints** - Auto-generate webhook endpoints for each workflow
- 🔄 **Version Management** - Organize workflows by version with semantic versioning
- ⚡ **Real-time Execution** - Execute workflows with live status updates and detailed logs
- 💾 **Auto-save** - Never lose your work with automatic saving
- 🐳 **Docker Ready** - Single command deployment with Docker or Kubernetes

### 🧩 Built-in Node Types

| Node Type | Purpose |
|-----------|---------|
| **Trigger** | Start workflows via webhook, schedule (cron), or manual trigger |
| **Transform** | **Map and transform data between schemas** ⭐ |
| **HTTP Request** | Connect to external APIs and services |
| **Condition** | Branch workflow based on data conditions |
| **Loop** | Iterate over arrays and collections |
| **Code** | Custom JavaScript expressions for advanced logic |
| **Response** | Configure HTTP response output |

### 🔐 Authentication & Security

- **Role-Based Access Control (RBAC)** - Granular permissions for all resources
- **User Management** - Invite users, manage profiles, and track activity
- **SSO Support** - Google and Microsoft OAuth integration
- **JWT Authentication** - Secure token-based authentication with refresh tokens

### 🤖 AI-Powered Features

- **AI Test Data Generation** - Generate sample data using OpenAI based on your schemas
- **Schema-aware Generation** - AI understands your data structures

### ⚙️ Customization

- **Theming** - Light/Dark/System theme support
- **App Settings** - Customizable project name, logo, and colors
- **Custom Node Types** - Define and manage custom node types

## 🎯 Use Cases

| Use Case | Description |
|----------|-------------|
| **API Integration** | Map data between different API formats (REST, webhooks) |
| **ETL Pipelines** | Extract, Transform, Load data between systems |
| **Data Migration** | Transform data schemas during system migrations |
| **Webhook Processing** | Receive webhooks and transform payloads for downstream systems |
| **Data Synchronization** | Keep data in sync between multiple services |
| **Format Conversion** | Convert between JSON, XML, CSV, and custom formats |

## 🏗️ Architecture

```text
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (React)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ Flow Canvas │  │  Node Panel │  │  Settings & Config  │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                    Backend (Go + Gin)                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Handlers  │  │  Executor   │  │    Repositories     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                     MongoDB Database                         │
│  ┌───────────┐  ┌──────────┐  ┌────────────┐  ┌──────────┐  │
│  │ Workflows │  │ Versions │  │ Executions │  │ Schemas  │  │
│  └───────────┘  └──────────┘  └────────────┘  └──────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## 🚀 Quick Start

### Option 1: Docker (Recommended)

Run everything with a single command:

```bash
# Clone the repository
git clone https://github.com/nodetl/nodetl.git
cd nodetl

# Start all services
docker compose up -d

# Access the application
# Frontend: http://localhost:8602
# Backend API: http://localhost:8602/api/v1 (proxied through frontend)
```

### Option 2: All-in-One Docker Image

Build and run a single Docker image containing everything:

```bash
# Build the all-in-one image
docker build -f Dockerfile -t nodetl:latest .

# Run the container
docker run -d --name nodetl -p 8602:80 -v nodetl_data:/data/db nodetl:latest

# Access at http://localhost:8602
```

### Option 3: Development Setup

```bash
# Prerequisites: Go 1.21+, Node.js 20+, MongoDB 7.0

# Backend (runs on port 8603)
cd src/backend
cp .env.example .env
go mod download
go run ./cmd/server

# Frontend (runs on port 8602, new terminal)
cd src/frontend
npm install
npm run dev
```

## 📁 Project Structure

```text
nodetl/
├── src/
│   ├── backend/                 # Go backend
│   │   ├── cmd/server/          # Application entry point
│   │   ├── config/              # Configuration management
│   │   ├── internal/
│   │   │   ├── domain/          # Domain models
│   │   │   ├── handler/         # HTTP handlers
│   │   │   ├── repository/      # Data access layer
│   │   │   ├── service/         # Business logic
│   │   │   ├── executor/        # Workflow execution engine
│   │   │   └── middleware/      # HTTP middleware
│   │   └── pkg/                 # Shared packages
│   │
│   └── frontend/                # React frontend
│       ├── src/
│       │   ├── components/      # React components
│       │   ├── pages/           # Page components
│       │   ├── stores/          # State management (Zustand)
│       │   ├── api/             # API client
│       │   └── types/           # TypeScript types
│       └── public/              # Static assets
│
├── docs/                        # Documentation
├── docker-compose.yml           # Multi-container Docker setup
├── Dockerfile                   # All-in-one Docker image
├── Makefile                     # Build automation
└── README.md                    # This file
```

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `SERVER_PORT` | Backend server port | `8603` |
| `SERVER_MODE` | Server mode (debug/release) | `debug` |
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017` |
| `MONGODB_DATABASE` | Database name | `nodetl` |
| `LOG_LEVEL` | Logging level | `info` |
| `LOG_FORMAT` | Log format (json/text) | `json` |
| `AUTH_AUTO_CREATE_ADMIN` | Auto-create admin on first run | `true` |

### Backend Configuration

Create a `.env` file in `src/backend/`:

```env
SERVER_PORT=8603
SERVER_MODE=debug
MONGODB_URI=mongodb://localhost:27017
MONGODB_DATABASE=nodetl
LOG_LEVEL=debug
LOG_FORMAT=json
AUTH_AUTO_CREATE_ADMIN=true
```

## 🔐 Default Admin Account

On first startup, NodeTL automatically creates a default admin account. **Check the backend logs for the generated credentials:**

```bash
# Docker Compose
docker logs nodetl-backend 2>&1 | grep -A 5 "ADMIN"

# All-in-One Docker
docker logs nodetl 2>&1 | grep -A 5 "ADMIN"

# Or view supervisor logs
docker exec nodetl cat /var/log/supervisor/backend.log | grep -A 5 "ADMIN"
```

You will see output like:

```text
========================================
DEFAULT ADMIN ACCOUNT CREATED
========================================
Email: admin@nodetl.local
Password: <random-generated-password>
========================================
PLEASE CHANGE THIS PASSWORD IMMEDIATELY!
========================================
```

> ⚠️ **Important:** The password is randomly generated and only shown once in the logs. Make sure to save it and change it after first login.

## 📚 API Documentation

### Workflows

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/workflows` | List all workflows |
| `POST` | `/api/v1/workflows` | Create a new workflow |
| `GET` | `/api/v1/workflows/:id` | Get workflow by ID |
| `PUT` | `/api/v1/workflows/:id` | Update workflow |
| `DELETE` | `/api/v1/workflows/:id` | Delete workflow |
| `POST` | `/api/v1/workflows/:id/activate` | Activate workflow |
| `POST` | `/api/v1/workflows/:id/execute` | Execute workflow |

### Versions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/versions` | List all versions |
| `POST` | `/api/v1/versions` | Create a new version |
| `PUT` | `/api/v1/versions/:id` | Update version |
| `DELETE` | `/api/v1/versions/:id` | Delete version |
| `POST` | `/api/v1/versions/:id/set-default` | Set as default version |

### Schemas

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/v1/schemas` | List all schemas |
| `POST` | `/api/v1/schemas` | Create a new schema |
| `GET` | `/api/v1/schemas/predefined` | Get predefined schemas |

## 🛠️ Development

### Prerequisites

- Go 1.21 or later
- Node.js 20 or later
- MongoDB 7.0 or later
- Docker & Docker Compose (optional)

### Running Tests

```bash
# Backend tests
cd src/backend
go test -v ./...

# Frontend tests
cd src/frontend
npm test
```

### Building for Production

```bash
# Build backend
cd src/backend
go build -o nodetl ./cmd/server

# Build frontend
cd src/frontend
npm run build
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for details.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [React Flow](https://reactflow.dev/) - Interactive node-based UI
- [Gin](https://gin-gonic.com/) - HTTP web framework for Go
- [MongoDB](https://www.mongodb.com/) - Document database
- [Tailwind CSS](https://tailwindcss.com/) - Utility-first CSS framework

## 📞 Support

- 📧 Email: [support@nodetl.dev](mailto:thanhcong86.work@gmail.com)
- 💬 Discord: [Join our community](https://discord.gg/saGeuzpg4v)
- 🐛 Issues: [GitHub Issues](https://github.com/nodetl/nodetl/issues)

---

Made with ❤️ by the NodeTL Team
