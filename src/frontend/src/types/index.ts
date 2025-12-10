// Version type for grouping workflows (deprecated - use Project instead)
export interface Version {
  id: string;
  tag: string;           // e.g., "1.0.0", "2.0.0"
  name?: string;         // Display name
  description?: string;
  pathPrefix: string;    // e.g., "/api/v1"
  headers?: Record<string, string>;     // Required headers for this version
  queryParams?: Record<string, string>; // Default query params
  isDefault?: boolean;
  createdAt: string;
  updatedAt: string;
}

// Project type - container for workflows with version tag
export interface Project {
  id: string;
  name: string;
  description: string;
  versionTag: string;    // e.g., "1.0.0", "2.0.0"
  pathPrefix: string;    // e.g., "/api/v1"
  isLocked?: boolean;    // When true, no changes allowed
  workflows: Workflow[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface ProjectListResponse {
  data: Project[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

// Workflow types
export interface Workflow {
  id: string;
  name: string;
  description: string;
  version: number;
  versionTag?: string; // Semantic version like "1.0.0", "2.0.0"
  projectId?: string; // Reference to project
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  endpoint?: EndpointConfig;
  settings?: WorkflowSettings;
  variables?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

// Workflow settings
export interface WorkflowSettings {
  autoSave?: boolean; // Legacy
  autoSaveEnabled?: boolean;
  webhookPath?: string;
  customHeaders?: Record<string, string>; // Headers to require/inject
}

// Endpoint configuration
export interface EndpointConfig {
  path: string;
  method: string;
  authType: 'none' | 'api_key' | 'bearer';
  authConfig?: Record<string, string>;
  headers?: Record<string, string>; // Custom headers for this endpoint
}

export type WorkflowStatus = 'draft' | 'active' | 'inactive' | 'archived';

export interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  position: Position;
  data: NodeData;
  inputs?: NodePort[];
  outputs?: NodePort[];
}

export interface Position {
  x: number;
  y: number;
}

export interface NodePort {
  id: string;
  name: string;
  type: string;
}

export interface NodeData {
  description?: string;
  triggerType?: string;
  webhookPath?: string;
  webhookMethod?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  webhookHeaders?: Record<string, string>;
  schedule?: string;
  sourceSchemaId?: string;
  targetSchemaId?: string;
  mappingRules?: MappingRule[];
  httpMethod?: string;
  httpUrl?: string;
  httpHeaders?: Record<string, string>;
  httpBody?: string;
  conditions?: Condition[];
  loopType?: string;
  loopArrayPath?: string;
  loopCondition?: string;
  code?: string;
  customConfig?: Record<string, unknown>;
  responseConfig?: ResponseConfig;
}

export interface ResponseConfig {
  statusCode: number;
  headers: Record<string, string>;
  selectedFields: ResponseField[];
  useTemplate?: boolean; // Use custom JSON template instead of field selection
  responseTemplate?: string; // JSON template with {{field}} placeholders
  errorConfig?: ErrorConfig; // Error handling configuration
}

// Error handling configuration
export interface ErrorConfig {
  includeTraceId: boolean; // Include trace ID in error response
  useCustomTemplate: boolean; // Use custom error template
  errorTemplate?: string; // Custom error template
  errorStatusCode?: number; // Default error status code (default 500)
  validationErrors?: ValidationErrorConfig; // 400 Bad Request config
  notFoundErrors?: ValidationErrorConfig; // 404 Not Found config
  unauthorizedErrors?: ValidationErrorConfig; // 401 Unauthorized config
  forbiddenErrors?: ValidationErrorConfig; // 403 Forbidden config
}

export interface ValidationErrorConfig {
  enabled: boolean;
  statusCode: number;
  template?: string; // Custom template for this error type
}

export interface ResponseField {
  id: string;
  fieldPath: string;
  source: 'transform' | 'http'; // transform = target fields từ Transform, http = response từ HTTP Request
  sourceNodeId?: string;
  alias?: string;
}

export interface MappingRule {
  id: string;
  sourceField: string;
  targetField: string;
  transform?: string;
  defaultValue?: unknown;
}

export interface Condition {
  id: string;
  field: string;
  operator: string;
  value: unknown;
  outputId: string;
}

export interface WorkflowEdge {
  id: string;
  source: string;
  target: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

// Node types
export interface NodeType {
  id: string;
  name: string;
  type: string;
  category: string;
  description: string;
  icon: string;
  color: string;
  isBuiltIn: boolean;
  inputs: PortDefinition[];
  outputs: PortDefinition[];
  configSchema: Record<string, unknown>;
}

export interface PortDefinition {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

// Schema types
export interface Schema {
  id: string;
  name: string;
  description: string;
  version: string;
  type: 'predefined' | 'custom';
  category: string;
  fields: SchemaField[];
  jsonSchema: Record<string, unknown>;
  examples?: Record<string, unknown>[];
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface SchemaField {
  name: string;
  path: string;
  type: string;
  required: boolean;
  description: string;
  format?: string;
  enum?: unknown[];
  default?: unknown;
  children?: SchemaField[];
}

// Execution types
export interface Execution {
  id: string;
  workflowId: string;
  workflowName: string;
  status: ExecutionStatus;
  triggerType: string;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: ExecutionError;
  nodeLogs: NodeExecutionLog[];
  startedAt: string;
  completedAt?: string;
  duration: number;
  metadata?: Record<string, unknown>;
}

export type ExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface ExecutionError {
  nodeId: string;
  message: string;
  code?: string;
  stack?: string;
}

export interface NodeExecutionLog {
  nodeId: string;
  nodeType: string;
  nodeLabel: string;
  status: ExecutionStatus;
  input: Record<string, unknown>;
  output?: Record<string, unknown>;
  error?: string;
  startedAt: string;
  completedAt?: string;
  duration: number;
  logs?: LogEntry[];
}

export interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  data?: unknown;
}

// Mapping types
export interface FieldMapping {
  id: string;
  name: string;
  description: string;
  sourceSchemaId: string;
  targetSchemaId: string;
  rules: MappingRule[];
  aiGenerated: boolean;
  confidence: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string;
}

export interface AIMappingResponse {
  rules: MappingRule[];
  confidence: number;
  explanation: string;
  suggestions?: string[];
}
