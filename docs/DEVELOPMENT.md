# Development Guide

This guide covers setting up a development environment for NodeTL.

## Prerequisites

- **Go 1.21+** - Backend development
- **Node.js 20+** - Frontend development
- **MongoDB 7.0+** - Database
- **Docker** - For running MongoDB easily
- **Git** - Version control

## Quick Setup

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/nodetl.git
cd nodetl
```

### 2. Start MongoDB

```bash
# Using Docker (recommended)
docker run -d -p 27017:27017 --name mongo mongo:7.0

# Or use docker-compose for just MongoDB
docker compose up -d mongodb
```

### 3. Start Backend

```bash
cd src/backend

# Copy environment file
cp .env.example .env

# Download dependencies
go mod download

# Run in development mode
go run ./cmd/server
```

Backend will be available at `http://localhost:8080` (or `8603` if running via Docker Compose).

### 4. Start Frontend

```bash
cd src/frontend

# Install dependencies
npm install

# Run in development mode
npm run dev
```

Frontend will be available at `http://localhost:5173`

## Project Structure

```
nodetl/
├── src/
│   ├── backend/                    # Go backend
│   │   ├── cmd/
│   │   │   └── server/
│   │   │       └── main.go         # Entry point
│   │   ├── config/
│   │   │   └── config.go           # Configuration loading
│   │   ├── internal/
│   │   │   ├── domain/             # Domain models
│   │   │   │   ├── workflow.go
│   │   │   │   ├── node_schema.go
│   │   │   │   ├── mapping.go
│   │   │   │   └── execution.go
│   │   │   ├── handler/            # HTTP handlers
│   │   │   │   ├── workflow_handler.go
│   │   │   │   ├── mapping_handler.go
│   │   │   │   ├── ai_handler.go
│   │   │   │   └── ...
│   │   │   ├── repository/         # Data access
│   │   │   │   ├── workflow_repository.go
│   │   │   │   └── ...
│   │   │   ├── service/            # Business logic
│   │   │   ├── executor/           # Workflow execution
│   │   │   ├── node/               # Node implementations
│   │   │   └── middleware/         # HTTP middleware
│   │   └── pkg/                    # Shared packages
│   │       ├── mongodb/
│   │       ├── logger/
│   │       └── ai/
│   │
│   └── frontend/                   # React frontend
│       ├── src/
│       │   ├── components/         # React components
│       │   │   ├── FlowCanvas.tsx
│       │   │   ├── NodePanel.tsx
│       │   │   └── ...
│       │   ├── pages/              # Page components
│       │   │   ├── WorkflowListPage.tsx
│       │   │   ├── WorkflowEditorPage.tsx
│       │   │   └── ...
│       │   ├── stores/             # Zustand stores
│       │   │   └── workflowStore.ts
│       │   ├── api/                # API client
│       │   │   └── index.ts
│       │   ├── types/              # TypeScript types
│       │   │   └── index.ts
│       │   └── lib/                # Utilities
│       ├── public/                 # Static assets
│       └── index.html
│
├── docs/                           # Documentation
├── docker-compose.yml
├── Dockerfile
├── Makefile
└── README.md
```

## Backend Development

### Adding a New API Endpoint

1. **Create Domain Model** (if needed)

```go
// src/backend/internal/domain/mymodel.go
package domain

type MyModel struct {
    ID        primitive.ObjectID `json:"id" bson:"_id,omitempty"`
    Name      string             `json:"name" bson:"name"`
    CreatedAt time.Time          `json:"createdAt" bson:"created_at"`
}
```

1. **Create Repository**

```go
// src/backend/internal/repository/mymodel_repository.go
package repository

type MyModelRepository struct {
    collection *mongo.Collection
}

func NewMyModelRepository(client *mongodb.Client) *MyModelRepository {
    return &MyModelRepository{
        collection: client.Collection("mymodels"),
    }
}

func (r *MyModelRepository) Create(ctx context.Context, model *domain.MyModel) error {
    // Implementation
}
```

1. **Create Handler**

```go
// src/backend/internal/handler/mymodel_handler.go
package handler

type MyModelHandler struct {
    repo *repository.MyModelRepository
}

func NewMyModelHandler(repo *repository.MyModelRepository) *MyModelHandler {
    return &MyModelHandler{repo: repo}
}

func (h *MyModelHandler) Create(c *gin.Context) {
    // Implementation
}
```

1. **Register Routes** in `main.go`

```go
myModelRepo := repository.NewMyModelRepository(mongoClient)
myModelHandler := handler.NewMyModelHandler(myModelRepo)

api.POST("/mymodels", myModelHandler.Create)
api.GET("/mymodels", myModelHandler.List)
```

### Running Tests

```bash
cd src/backend
go test -v ./...

# With coverage
go test -cover -coverprofile=coverage.out ./...
go tool cover -html=coverage.out
```

## Frontend Development

### Adding a New Page

1. **Create Page Component**

```tsx
// src/frontend/src/pages/MyPage.tsx
import { useQuery } from '@tanstack/react-query';
import { myApi } from '@/api';

export default function MyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['mydata'],
    queryFn: myApi.list,
  });

  if (isLoading) return <div>Loading...</div>;

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold">My Page</h1>
      {/* Content */}
    </div>
  );
}
```

1. **Add Route** in `App.tsx`

```tsx
import MyPage from '@/pages/MyPage';

<Route path="/mypage" element={<MyPage />} />
```

1. **Add API Client** (if needed)

```tsx
// src/frontend/src/api/index.ts
export const myApi = {
  list: async () => {
    const { data } = await api.get('/mymodels');
    return data;
  },
  create: async (model: Partial<MyModel>) => {
    const { data } = await api.post('/mymodels', model);
    return data;
  },
};
```

### Adding a New Node Type

1. **Define Node Type** in backend

```go
// Add to node_type_repository.go SeedBuiltIn()
{
    Type:        "my_node",
    Name:        "My Custom Node",
    Category:    "custom",
    Description: "Does something special",
    Icon:        "🔧",
    Color:       "#FF6B6B",
    IsBuiltIn:   true,
    Inputs:      []domain.PortDefinition{{Name: "input", Type: "any"}},
    Outputs:     []domain.PortDefinition{{Name: "output", Type: "any"}},
}
```

1. **Handle in Executor**

```go
// src/backend/internal/executor/flow_executor.go
case "my_node":
    result, err = e.executeMyNode(ctx, node, input)
```

1. **Style in Frontend** (optional)

```tsx
// src/frontend/src/components/FlowCanvas.tsx
// Add custom styling for the node type
```

## Code Style

### Go

- Follow [Effective Go](https://golang.org/doc/effective_go)
- Use `gofmt` for formatting
- Use meaningful names
- Add comments for exported functions

### TypeScript/React

- Use functional components
- Use TypeScript strictly
- Use Tailwind CSS for styling
- Follow React best practices

## Hot Reload

### Backend

Install `air` for hot reload:

```bash
go install github.com/cosmtrek/air@latest
cd src/backend
air
```

### Frontend

Vite provides hot reload by default with `npm run dev`.

## Debugging

### Backend (VS Code)

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Launch Backend",
      "type": "go",
      "request": "launch",
      "mode": "auto",
      "program": "${workspaceFolder}/src/backend/cmd/server",
      "cwd": "${workspaceFolder}/src/backend"
    }
  ]
}
```

### Frontend (Browser DevTools)

- React DevTools extension
- Network tab for API debugging
- Console for errors

## Common Tasks

### Reset Database

```bash
docker exec -it workflow-mongodb mongosh nodetl --eval "db.dropDatabase()"
```

### View MongoDB Data

```bash
docker exec -it workflow-mongodb mongosh nodetl

# In mongosh
db.workflows.find().pretty()
db.versions.find().pretty()
```

### Build for Production

```bash
# Backend
cd src/backend
go build -o nodetl ./cmd/server

# Frontend
cd src/frontend
npm run build
```

## Troubleshooting

### Port already in use

```bash
# Find process
lsof -i :8080
lsof -i :5173

# Kill process
kill -9 <PID>
```

### MongoDB connection failed

```bash
# Check if MongoDB is running
docker ps | grep mongo

# Restart MongoDB
docker restart mongo
```

### npm install fails

```bash
# Clear cache
rm -rf node_modules package-lock.json
npm cache clean --force
npm install
```
