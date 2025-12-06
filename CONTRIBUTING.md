# Contributing to NodeTL

First off, thank you for considering contributing to NodeTL! It's people like you that make this project great.

## Code of Conduct

This project and everyone participating in it is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## How Can I Contribute?

### Reporting Bugs

Before creating bug reports, please check the issue list as you might find out that you don't need to create one. When you are creating a bug report, please include as many details as possible:

- **Use a clear and descriptive title** for the issue
- **Describe the exact steps which reproduce the problem**
- **Provide specific examples to demonstrate the steps**
- **Describe the behavior you observed after following the steps**
- **Explain which behavior you expected to see instead and why**
- **Include screenshots and animated GIFs** if possible
- **Include your environment details** (OS, Docker version, Go version, Node version)

### Suggesting Enhancements

Enhancement suggestions are tracked as GitHub issues. When creating an enhancement suggestion, please include:

- **Use a clear and descriptive title** for the issue
- **Provide a step-by-step description of the suggested enhancement**
- **Provide specific examples to demonstrate the steps**
- **Describe the current behavior** and **explain which behavior you expected to see instead**
- **Explain why this enhancement would be useful**

### Pull Requests

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Development Setup

### Prerequisites

- Go 1.21+
- Node.js 20+
- MongoDB 7.0+
- Docker & Docker Compose

### Setting Up Development Environment

```bash
# Clone your fork
git clone https://github.com/YOUR_USERNAME/nodetl.git
cd nodetl

# Add upstream remote
git remote add upstream https://github.com/ORIGINAL_OWNER/nodetl.git

# Install backend dependencies
cd src/backend
go mod download

# Install frontend dependencies
cd ../frontend
npm install
```

### Running in Development Mode

```bash
# Terminal 1: Start MongoDB
docker run -d -p 27017:27017 --name mongo mongo:7.0

# Terminal 2: Start Backend
cd src/backend
go run ./cmd/server

# Terminal 3: Start Frontend
cd src/frontend
npm run dev
```

### Running Tests

```bash
# Backend tests
cd src/backend
go test -v ./...

# Frontend tests
cd src/frontend
npm test
```

## Style Guides

### Git Commit Messages

- Use the present tense ("Add feature" not "Added feature")
- Use the imperative mood ("Move cursor to..." not "Moves cursor to...")
- Limit the first line to 72 characters or less
- Reference issues and pull requests liberally after the first line

Examples:
```
feat: add workflow version management
fix: resolve auto-save timing issue
docs: update API documentation
refactor: simplify executor logic
test: add unit tests for handler
```

### Go Style Guide

- Follow the [Effective Go](https://golang.org/doc/effective_go) guidelines
- Use `gofmt` to format your code
- Use meaningful variable and function names
- Add comments for exported functions and types
- Keep functions focused and small

### TypeScript/React Style Guide

- Use functional components with hooks
- Use TypeScript for type safety
- Follow the [React documentation](https://react.dev/) best practices
- Use meaningful component and variable names
- Keep components focused and reusable

### Documentation Style Guide

- Use [Markdown](https://guides.github.com/features/mastering-markdown/) for documentation
- Reference functions with backticks: \`functionName()\`
- Include code examples where helpful
- Keep language clear and concise

## Project Structure

```
src/
├── backend/
│   ├── cmd/server/          # Entry point
│   ├── config/              # Configuration
│   ├── internal/
│   │   ├── domain/          # Domain models
│   │   ├── handler/         # HTTP handlers
│   │   ├── repository/      # Data layer
│   │   ├── service/         # Business logic
│   │   └── executor/        # NodeTL engine
│   └── pkg/                 # Shared packages
│
└── frontend/
    ├── src/
    │   ├── components/      # UI components
    │   ├── pages/           # Page components
    │   ├── stores/          # State management
    │   ├── api/             # API client
    │   └── types/           # TypeScript types
    └── public/              # Static assets
```

## Additional Notes

### Issue and Pull Request Labels

| Label | Description |
|-------|-------------|
| `bug` | Something isn't working |
| `enhancement` | New feature or request |
| `documentation` | Improvements or additions to documentation |
| `good first issue` | Good for newcomers |
| `help wanted` | Extra attention is needed |
| `question` | Further information is requested |

## Recognition

Contributors who make significant contributions will be added to our [CONTRIBUTORS.md](CONTRIBUTORS.md) file.

Thank you for contributing! 🎉
