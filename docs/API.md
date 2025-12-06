# API Documentation

This document provides detailed information about the NodeTL REST API.

## Base URL

```text
http://localhost:8602/api/v1
```

> **Note**: Port `8602` is the frontend/nginx port. The backend runs internally on port `8603` and is proxied through nginx.

## Authentication

The API uses JWT (JSON Web Token) authentication. Include the access token in the Authorization header:

```text
Authorization: Bearer <access_token>
```

### Public Endpoints (No Authentication Required)

- `POST /auth/login` - Login
- `POST /auth/register` - Register (if enabled)
- `POST /auth/refresh` - Refresh token
- `GET /auth/google` - Google OAuth
- `GET /auth/google/callback` - Google OAuth callback
- `GET /auth/microsoft` - Microsoft OAuth
- `GET /auth/microsoft/callback` - Microsoft OAuth callback
- `GET /settings/public` - Public app settings
- `GET /health` - Health check

## Response Format

All responses are returned in JSON format:

```json
{
  "data": { ... },
  "message": "Success",
  "error": null
}
```

Error responses:

```json
{
  "error": "Error message"
}
```

---

## Auth

### Login

```http
POST /auth/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Response:**

```json
{
  "accessToken": "eyJhbGciOiJIUzI1NiIs...",
  "refreshToken": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "507f1f77bcf86cd799439011",
    "email": "user@example.com",
    "name": "John Doe",
    "roleId": "507f1f77bcf86cd799439012",
    "permissions": ["workflow:view", "workflow:edit"]
  }
}
```

### Refresh Token

```http
POST /auth/refresh
```

**Request Body:**

```json
{
  "refreshToken": "eyJhbGciOiJIUzI1NiIs..."
}
```

### Logout

```http
POST /auth/logout
```

### Get Current User

```http
GET /auth/me
```

### Change Password

```http
POST /auth/change-password
```

**Request Body:**

```json
{
  "currentPassword": "oldpassword",
  "newPassword": "newpassword123"
}
```

### Google OAuth

```http
GET /auth/google
```

Redirects to Google OAuth consent screen.

### Microsoft OAuth

```http
GET /auth/microsoft
```

Redirects to Microsoft OAuth consent screen.

---

## Users

### List Users

```http
GET /users
```

**Required Permission:** `user:view`

### Get User

```http
GET /users/:id
```

### Create User

```http
POST /users
```

**Required Permission:** `user:edit`

**Request Body:**

```json
{
  "email": "newuser@example.com",
  "name": "New User",
  "roleId": "507f1f77bcf86cd799439012",
  "password": "password123"
}
```

### Update User

```http
PUT /users/:id
```

### Delete User

```http
DELETE /users/:id
```

**Required Permission:** `user:delete`

---

## Roles

### List Roles

```http
GET /roles
```

**Required Permission:** `role:view`

### Get Role

```http
GET /roles/:id
```

### Create Role

```http
POST /roles
```

**Required Permission:** `role:edit`

**Request Body:**

```json
{
  "name": "Editor",
  "description": "Can edit workflows and schemas",
  "permissions": [
    "workflow:view",
    "workflow:edit",
    "schema:view",
    "schema:edit"
  ]
}
```

### Update Role

```http
PUT /roles/:id
```

### Delete Role

```http
DELETE /roles/:id
```

**Required Permission:** `role:delete`

### List Available Permissions

```http
GET /roles/permissions
```

---

## Invitations

### List Invitations

```http
GET /invitations
```

**Required Permission:** `user:invite`

### Create Invitation

```http
POST /invitations
```

**Request Body:**

```json
{
  "email": "invited@example.com",
  "roleId": "507f1f77bcf86cd799439012"
}
```

### Resend Invitation

```http
POST /invitations/:id/resend
```

### Cancel Invitation

```http
DELETE /invitations/:id
```

### Accept Invitation (Public)

```http
POST /invitations/accept
```

**Request Body:**

```json
{
  "token": "invitation-token",
  "name": "New User",
  "password": "password123"
}
```

---

## Settings

### Get Public Settings

```http
GET /settings/public
```

**No authentication required.**

**Response:**

```json
{
  "projectName": "NodeTL",
  "logoUrl": "/logo.svg",
  "faviconUrl": "/logo.png",
  "primaryColor": "#0ea5e9",
  "secondaryColor": "#6366f1"
}
```

### Get Settings

```http
GET /settings
```

**Required Permission:** `settings:view`

### Update Settings

```http
PUT /settings
```

**Required Permission:** `settings:edit`

**Request Body:**

```json
{
  "projectName": "My App",
  "logoUrl": "/custom-logo.svg",
  "primaryColor": "#3b82f6",
  "secondaryColor": "#8b5cf6"
}
```

---

## Workflows

### List Workflows

```http
GET /workflows
```

**Response:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "name": "My Workflow",
      "description": "A sample workflow",
      "status": "active",
      "versionTag": "1.0.0",
      "nodes": [...],
      "edges": [...],
      "createdAt": "2025-12-05T10:00:00Z",
      "updatedAt": "2025-12-05T10:00:00Z"
    }
  ],
  "total": 1
}
```

### Get Workflow

```http
GET /workflows/:id
```

**Parameters:**

| Name | Type | Description |
|------|------|-------------|
| id | string | Workflow ID |

### Create Workflow

```http
POST /workflows
```

**Request Body:**

```json
{
  "name": "My Workflow",
  "description": "A sample workflow",
  "versionTag": "1.0.0",
  "nodes": [],
  "edges": []
}
```

### Update Workflow

```http
PUT /workflows/:id
```

**Request Body:**

```json
{
  "name": "Updated Workflow",
  "description": "Updated description",
  "nodes": [...],
  "edges": [...]
}
```

### Delete Workflow

```http
DELETE /workflows/:id
```

### Activate Workflow

```http
POST /workflows/:id/activate
```

### Deactivate Workflow

```http
POST /workflows/:id/deactivate
```

### Execute Workflow

```http
POST /workflows/:id/execute
```

**Request Body:**

```json
{
  "input": {
    "key": "value"
  }
}
```

### Auto-save Workflow

```http
POST /workflows/:id/autosave
```

**Request Body:**

```json
{
  "nodes": [...],
  "edges": [...]
}
```

---

## Versions

### List Versions

```http
GET /versions
```

**Response:**

```json
{
  "data": [
    {
      "id": "507f1f77bcf86cd799439011",
      "tag": "1.0.0",
      "name": "Production",
      "pathPrefix": "/api/v1",
      "isDefault": true,
      "headers": {},
      "queryParams": {},
      "createdAt": "2025-12-05T10:00:00Z",
      "updatedAt": "2025-12-05T10:00:00Z"
    }
  ]
}
```

### Create Version

```http
POST /versions
```

**Request Body:**

```json
{
  "tag": "2.0.0",
  "name": "Beta",
  "pathPrefix": "/api/v2",
  "headers": {
    "X-Version": "2.0"
  },
  "queryParams": {}
}
```

### Update Version

```http
PUT /versions/:id
```

### Delete Version

```http
DELETE /versions/:id
```

### Set Default Version

```http
POST /versions/:id/set-default
```

---

## Schemas

### List Schemas

```http
GET /schemas
```

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| type | string | Filter by type (source/target) |
| category | string | Filter by category |

### Get Predefined Schemas

```http
GET /schemas/predefined
```

### Create Schema

```http
POST /schemas
```

**Request Body:**

```json
{
  "name": "Customer",
  "type": "source",
  "category": "crm",
  "fields": [
    {
      "name": "id",
      "type": "string",
      "required": true
    },
    {
      "name": "email",
      "type": "string",
      "required": true
    }
  ]
}
```

### Update Schema

```http
PUT /schemas/:id
```

### Delete Schema

```http
DELETE /schemas/:id
```

---

## Node Types

### List Node Types

```http
GET /node-types
```

**Query Parameters:**

| Name | Type | Description |
|------|------|-------------|
| category | string | Filter by category |
| builtIn | boolean | Filter by built-in status |

### Get Built-in Node Types

```http
GET /node-types/built-in
```

---

## Executions

### Get Execution

```http
GET /executions/:id
```

### List Workflow Executions

```http
GET /workflows/:workflowId/executions
```

### Get Latest Executions

```http
GET /workflows/:workflowId/executions/latest
```

---

## AI Features

### Get AI Status

```http
GET /ai/status
```

**Response:**

```json
{
  "enabled": true,
  "message": "AI features are available"
}
```

### Generate Test Data

```http
POST /ai/generate-test-data
```

**Request Body:**

```json
{
  "sourceSchema": { ... },
  "description": "Generate sample customer data",
  "count": 10
}
```

---

## Health Check

```http
GET /health
```

**Response:**

```json
{
  "status": "ok"
}
```

---

## Webhooks

Webhooks allow external services to trigger workflow executions via HTTP requests.

### Webhook Endpoint

```http
POST /webhook/:path
GET /webhook/:path
```

The webhook path is configured in the workflow's trigger node settings.

**Example:**

If a workflow has a webhook trigger with path `/my-workflow`, it can be triggered via:

```text
POST http://localhost:8080/webhook/my-workflow
```

### Versioned API Webhooks

```http
POST /api/:version/:path
GET /api/:version/:path
```

**Example:**

```text
POST http://localhost:8080/api/v1/customers/sync
```

### Request Metadata

Webhook requests automatically include metadata in the input:

```json
{
  "_request": {
    "method": "POST",
    "path": "/webhook/my-workflow",
    "headers": { ... },
    "query": { ... },
    "ip": "192.168.1.1",
    "version": "v1"
  },
  "...your payload..."
}
```

---

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid input |
| 401 | Unauthorized - Missing or invalid authentication |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource not found |
| 409 | Conflict - Resource already exists |
| 500 | Internal Server Error |

---

## Permissions

The following permissions are available in the system:

| Permission | Description |
|------------|-------------|
| `workflow:view` | View workflows |
| `workflow:edit` | Create and edit workflows |
| `workflow:delete` | Delete workflows |
| `schema:view` | View schemas |
| `schema:edit` | Create and edit schemas |
| `schema:delete` | Delete schemas |
| `execution:view` | View execution history |
| `execution:run` | Execute workflows |
| `execution:delete` | Delete execution records |
| `mapping:view` | View mappings |
| `mapping:edit` | Create and edit mappings |
| `mapping:delete` | Delete mappings |
| `nodetype:view` | View node types |
| `nodetype:edit` | Create and edit node types |
| `nodetype:delete` | Delete node types |
| `version:view` | View versions |
| `version:edit` | Create and edit versions |
| `version:delete` | Delete versions |
| `user:view` | View users |
| `user:edit` | Create and edit users |
| `user:delete` | Delete users |
| `user:invite` | Invite new users |
| `role:view` | View roles |
| `role:edit` | Create and edit roles |
| `role:delete` | Delete roles |
| `settings:view` | View application settings |
| `settings:edit` | Edit application settings |

---

## Pagination

List endpoints support pagination with the following query parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | number | 1 | Page number |
| `pageSize` | number | 20 | Items per page |

**Response format:**

```json
{
  "data": [...],
  "total": 100,
  "page": 1,
  "pageSize": 20
}
```
