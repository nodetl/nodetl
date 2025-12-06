# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- Initial release of Workflow Engine
- Visual workflow designer with drag-and-drop interface
- Node-based workflow architecture
- Built-in node types: Webhook, HTTP Request, Transform, Condition, Loop, Response, Code
- REST API for workflow management
- Version management system for organizing workflows
- Auto-save functionality
- Docker support with single-image deployment
- MongoDB integration for data persistence

### Changed
- N/A

### Deprecated
- N/A

### Removed
- N/A

### Fixed
- N/A

### Security
- N/A

## [1.0.0] - 2025-12-05

### Added
- 🎨 Visual Workflow Designer
  - Drag-and-drop node placement
  - Interactive edge connections
  - Real-time canvas updates
  - Undo/Redo support
  
- 🔗 Node System
  - Webhook Trigger node
  - Schedule Trigger node
  - HTTP Request node
  - Transform node with schema mapping
  - Condition node for branching
  - Loop node for iterations
  - Response node for output configuration
  - Code node for custom logic
  
- 🌐 API Endpoints
  - Workflow CRUD operations
  - Version management
  - Schema management
  - Execution tracking
  - Auto-save endpoint
  
- 🔄 Version Management
  - Create and manage versions
  - Assign workflows to versions
  - Custom path prefixes per version
  - Default headers and query params
  - Drag-drop workflows between versions
  
- 💾 Data Persistence
  - MongoDB integration
  - Workflow state persistence
  - Execution history
  - Schema storage
  
- 🐳 Docker Support
  - Multi-container docker-compose setup
  - All-in-one Docker image
  - Volume persistence for data

---

[Unreleased]: https://github.com/yourusername/workflow-engine/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yourusername/workflow-engine/releases/tag/v1.0.0
