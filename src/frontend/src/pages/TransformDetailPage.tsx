import { useState, useRef, useCallback, useMemo, useLayoutEffect, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  DragStartEvent,
  DragEndEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  ArrowLeft,
  Save,
  Wand2,
  Loader2,
  Trash2,
  Code,
  Hash,
  Type,
  Calendar,
  ToggleLeft,
  Braces,
  Brackets,
  X,
  Check,
  Edit3,
  Eye,
  AlertCircle,
  ChevronDown,
  ArrowRight,
  GripVertical,
  Play,
  Zap,
  Upload,
  FileJson,
  Plus,
  FileUp,
  Shield,
  FileText,
  Settings2,
  Settings,
  Sparkles,
  Bot,
  Server,
  Key,
  Cpu,
  Globe,
} from 'lucide-react';
import { schemasApi, nodeSchemaApi, aiApi } from '@/api';
import { cn, generateId } from '@/lib/utils';
import type { SchemaField } from '@/types';

// ============ TYPES ============
interface MappingConnection {
  id: string;
  sourceField: string;
  targetField: string;
  formula: string;
  transformType: 'direct' | 'transform' | 'formula' | 'conditional';
  color: string;
  sourceType?: 'body' | 'header';  // Source từ body hoặc header
  config?: {
    builtInTransform?: string;
    condition?: string;
    trueValue?: string;
    falseValue?: string;
  };
  validation?: ValidationRule[];
}

interface ValidationRule {
  id: string;
  type: 'required' | 'minLength' | 'maxLength' | 'min' | 'max' | 'pattern' | 'email' | 'url' | 'enum' | 'custom';
  value?: string | number;
  message: string;
  enabled: boolean;
}

interface HeaderField {
  id: string;
  name: string;
  value: string;
  type: 'string';
  path: string;
}

// AI Provider Types
interface AIProvider {
  id: string;
  name: string;
  icon: string;
  type: 'cloud' | 'local';
  models: AIModel[];
  baseUrl?: string;
  requiresApiKey: boolean;
}

interface AIModel {
  id: string;
  name: string;
  description: string;
}

interface AIConfig {
  provider: string;
  model: string;
  apiKey: string;
  baseUrl: string;
  temperature: number;
}

interface AISuggestion {
  sourceField: string;
  targetField: string;
  confidence: number;
  reason: string;
  transformType: MappingConnection['transformType'];
  formula: string;
}

// Default AI Providers
const AI_PROVIDERS: AIProvider[] = [
  {
    id: 'openai',
    name: 'OpenAI',
    icon: '🤖',
    type: 'cloud',
    requiresApiKey: true,
    models: [
      { id: 'gpt-4o', name: 'GPT-4o', description: 'Most capable model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and efficient' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'Latest GPT-4' },
      { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', description: 'Fast, good for simple tasks' },
    ],
  },
  {
    id: 'anthropic',
    name: 'Anthropic',
    icon: '🧠',
    type: 'cloud',
    requiresApiKey: true,
    models: [
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet', description: 'Best balance' },
      { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', description: 'Most capable' },
      { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku', description: 'Fastest' },
    ],
  },
  {
    id: 'google',
    name: 'Google AI',
    icon: '✨',
    type: 'cloud',
    requiresApiKey: true,
    models: [
      { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', description: 'Advanced reasoning' },
      { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', description: 'Fast responses' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama (Local)',
    icon: '🦙',
    type: 'local',
    requiresApiKey: false,
    baseUrl: 'http://localhost:11434',
    models: [
      { id: 'llama3.2', name: 'Llama 3.2', description: 'Meta Llama 3.2' },
      { id: 'llama3.1', name: 'Llama 3.1', description: 'Meta Llama 3.1' },
      { id: 'mistral', name: 'Mistral', description: 'Mistral 7B' },
      { id: 'codellama', name: 'Code Llama', description: 'Optimized for code' },
      { id: 'qwen2.5', name: 'Qwen 2.5', description: 'Alibaba Qwen' },
      { id: 'deepseek-coder-v2', name: 'DeepSeek Coder V2', description: 'Code specialized' },
    ],
  },
  {
    id: 'lmstudio',
    name: 'LM Studio (Local)',
    icon: '🖥️',
    type: 'local',
    requiresApiKey: false,
    baseUrl: 'http://localhost:1234/v1',
    models: [
      { id: 'local-model', name: 'Local Model', description: 'Model loaded in LM Studio' },
    ],
  },
  {
    id: 'custom',
    name: 'Custom Endpoint',
    icon: '⚙️',
    type: 'local',
    requiresApiKey: false,
    models: [
      { id: 'custom', name: 'Custom Model', description: 'Your custom model' },
    ],
  },
];

// ============ COLOR UTILITIES ============
const FIELD_COLORS = [
  '#EF4444', '#F97316', '#F59E0B', '#EAB308', '#84CC16',
  '#22C55E', '#10B981', '#14B8A6', '#06B6D4', '#0EA5E9',
  '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7', '#D946EF',
  '#EC4899', '#F43F5E',
];

const getFieldColor = (fieldPath: string): string => {
  let hash = 0;
  for (let i = 0; i < fieldPath.length; i++) {
    hash = ((hash << 5) - hash) + fieldPath.charCodeAt(i);
    hash = hash & hash;
  }
  return FIELD_COLORS[Math.abs(hash) % FIELD_COLORS.length];
};

const getFieldTypeIcon = (type: string) => {
  const iconClass = "w-4 h-4 flex-shrink-0";
  switch (type) {
    case 'string': return <Type className={iconClass} />;
    case 'number': 
    case 'integer': return <Hash className={iconClass} />;
    case 'boolean': return <ToggleLeft className={iconClass} />;
    case 'date': return <Calendar className={iconClass} />;
    case 'array': return <Brackets className={iconClass} />;
    case 'object': return <Braces className={iconClass} />;
    default: return <Code className={iconClass} />;
  }
};

const flattenFields = (fields: SchemaField[], parentPath = ''): SchemaField[] => {
  const result: SchemaField[] = [];
  fields.forEach(field => {
    const path = parentPath ? `${parentPath}.${field.name}` : field.name;
    result.push({ ...field, path });
    if (field.children && field.children.length > 0) {
      result.push(...flattenFields(field.children, path));
    }
  });
  return result;
};

// ============ DRAGGABLE SOURCE FIELD ============
function DraggableField({ field, color, isConnected }: { 
  field: SchemaField; 
  color: string;
  isConnected: boolean;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${field.path}`,
    data: { field, type: 'source' },
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={cn(
        'flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 cursor-grab transition-all',
        'hover:shadow-lg active:cursor-grabbing',
        isDragging && 'opacity-50 scale-95',
        isConnected && 'ring-2 ring-offset-1'
      )}
      style={{ 
        borderColor: color,
        backgroundColor: `${color}15`,
        ...(isConnected && { ringColor: color })
      }}
    >
      <GripVertical className="w-4 h-4 text-gray-400" />
      <div 
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div style={{ color }} className="flex-shrink-0">
        {getFieldTypeIcon(field.type)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-sm truncate text-gray-800 dark:text-gray-200">{field.name}</div>
        {field.path !== field.name && (
          <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{field.path}</div>
        )}
      </div>
      <span 
        className="text-xs px-2 py-0.5 rounded-full font-medium"
        style={{ backgroundColor: `${color}20`, color }}
      >
        {field.type}
      </span>
    </div>
  );
}

// ============ DRAGGABLE HEADER FIELD ============
function DraggableHeaderField({ 
  header, 
  onUpdate,
  onRemove,
  isConnected 
}: { 
  header: HeaderField;
  onUpdate: (updates: Partial<HeaderField>) => void;
  onRemove: () => void;
  isConnected: boolean;
}) {
  const color = getFieldColor(header.path);
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `source-${header.path}`,
    data: { 
      field: { ...header, type: 'string' }, 
      type: 'source',
      sourceType: 'header'
    },
  });

  return (
    <div
      className={cn(
        'rounded-lg border-2 transition-all overflow-hidden',
        isDragging && 'opacity-50 scale-95',
        isConnected && 'ring-2 ring-offset-1'
      )}
      style={{ 
        borderColor: color,
        backgroundColor: `${color}10`,
        ...(isConnected && { ringColor: color })
      }}
    >
      <div
        ref={setNodeRef}
        {...listeners}
        {...attributes}
        className="flex items-center gap-2 px-3 py-2 cursor-grab active:cursor-grabbing"
      >
        <GripVertical className="w-4 h-4 text-gray-400" />
        <div 
          className="w-3 h-3 rounded-full flex-shrink-0"
          style={{ backgroundColor: color }}
        />
        <Settings2 size={14} style={{ color }} />
        <span className="text-xs font-medium px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">
          HEADER
        </span>
      </div>
      <div className="px-3 pb-2 space-y-1">
        <input
          type="text"
          value={header.name}
          onChange={(e) => onUpdate({ name: e.target.value, path: `headers.${e.target.value}` })}
          placeholder="Header name"
          className="w-full px-2 py-1.5 text-sm border rounded bg-white font-mono"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex gap-1">
          <input
            type="text"
            value={header.value}
            onChange={(e) => onUpdate({ value: e.target.value })}
            placeholder="Default value (optional)"
            className="flex-1 px-2 py-1.5 text-sm border rounded bg-white"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1.5 text-red-500 hover:bg-red-50 rounded"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ DROPPABLE TARGET FIELD ============
function DroppableField({ 
  field, 
  color, 
  connection,
  onEdit,
  onDelete,
  onValidation,
}: { 
  field: SchemaField; 
  color: string;
  connection?: MappingConnection;
  onEdit?: (conn: MappingConnection) => void;
  onDelete?: (id: string) => void;
  onValidation?: (conn: MappingConnection) => void;
}) {
  const { isOver, setNodeRef } = useDroppable({
    id: `target-${field.path}`,
    data: { field, type: 'target' },
  });

  const validationCount = connection?.validation?.filter(v => v.enabled).length || 0;

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-lg border-2 transition-all overflow-hidden bg-white dark:bg-gray-800',
        isOver && 'ring-4 ring-offset-2 scale-[1.02]',
        connection && 'shadow-md'
      )}
      style={{ 
        borderColor: connection ? connection.color : color,
        ...(isOver && { backgroundColor: `${color}20`, ringColor: color }),
        ...(connection && { backgroundColor: `${connection.color}10` }),
      }}
    >
      {/* Field Header */}
      <div className="flex items-center gap-2 px-3 py-2.5">
        <div 
          className="w-3 h-3 rounded-full flex-shrink-0 border-2 bg-white dark:bg-gray-700"
          style={{ 
            borderColor: connection ? connection.color : color,
            ...(connection && { backgroundColor: connection.color })
          }}
        />
        <div style={{ color: connection ? connection.color : color }} className="flex-shrink-0">
          {getFieldTypeIcon(field.type)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-medium text-sm truncate text-gray-800 dark:text-gray-200">{field.name}</div>
          {field.path !== field.name && (
            <div className="text-xs text-gray-400 dark:text-gray-500 truncate">{field.path}</div>
          )}
        </div>
        <span 
          className="text-xs px-2 py-0.5 rounded-full font-medium"
          style={{ 
            backgroundColor: connection ? `${connection.color}20` : `${color}20`, 
            color: connection ? connection.color : color 
          }}
        >
          {field.type}
        </span>
      </div>

      {/* Mapping Info */}
      {connection && (
        <div 
          className="px-3 py-2 border-t"
          style={{ borderColor: `${connection.color}30`, backgroundColor: `${connection.color}08` }}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              {connection.sourceType === 'header' ? (
                <Settings2 size={14} className="text-blue-500" />
              ) : (
                <Zap size={14} style={{ color: connection.color }} />
              )}
              <span className="text-xs font-medium" style={{ color: connection.color }}>
                ← {connection.sourceField}
              </span>
              {connection.sourceType === 'header' && (
                <span className="text-xs px-1 py-0.5 bg-blue-100 text-blue-600 rounded">HEADER</span>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => onValidation?.(connection)}
                className={cn(
                  "p-1 rounded transition-colors flex items-center gap-1",
                  validationCount > 0 ? "bg-green-100 text-green-600" : "hover:bg-gray-100 text-gray-400"
                )}
                title="Validation rules"
              >
                <Shield size={14} />
                {validationCount > 0 && (
                  <span className="text-xs font-medium">{validationCount}</span>
                )}
              </button>
              <button
                onClick={() => onEdit?.(connection)}
                className="p-1 rounded hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors"
                title="Edit formula"
              >
                <Edit3 size={14} className="text-gray-500" />
              </button>
              <button
                onClick={() => onDelete?.(connection.id)}
                className="p-1 rounded hover:bg-red-100 transition-colors"
                title="Delete"
              >
                <Trash2 size={14} className="text-red-400" />
              </button>
            </div>
          </div>
          
          {/* Formula */}
          <div 
            className="font-mono text-xs px-2 py-1.5 rounded"
            style={{ backgroundColor: `${connection.color}15` }}
          >
            <code style={{ color: connection.color }}>{connection.formula}</code>
          </div>
          
          {/* Validation badges */}
          {validationCount > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {connection.validation?.filter(v => v.enabled).map(v => (
                <span
                  key={v.id}
                  className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded"
                >
                  {v.type}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Drop hint */}
      {isOver && !connection && (
        <div className="px-3 py-2 border-t border-dashed animate-pulse" style={{ borderColor: color }}>
          <div className="text-xs text-center" style={{ color }}>
            Drop to create mapping
          </div>
        </div>
      )}
    </div>
  );
}

// ============ DRAG OVERLAY ============
function DragOverlayContent({ field, color }: { field: SchemaField; color: string }) {
  return (
    <div
      className="flex items-center gap-2 px-3 py-2.5 rounded-lg border-2 shadow-2xl cursor-grabbing"
      style={{ 
        borderColor: color,
        backgroundColor: 'white',
      }}
    >
      <div 
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ backgroundColor: color }}
      />
      <div style={{ color }} className="flex-shrink-0">
        {getFieldTypeIcon(field.type)}
      </div>
      <span className="font-medium text-sm">{field.name}</span>
      <ArrowRight size={16} className="text-gray-400" />
    </div>
  );
}

// ============ MAPPING PREVIEW PANEL ============
function MappingPreview({ 
  connections, 
  sourceFields,
  headerFields,
  onEdit,
  onDelete,
  testData,
  testHeaders,
  onTestDataChange,
  onTestHeadersChange,
}: { 
  connections: MappingConnection[];
  sourceFields: SchemaField[];
  headerFields: HeaderField[];
  onEdit: (conn: MappingConnection) => void;
  onDelete: (id: string) => void;
  testData: string;
  testHeaders: Record<string, string>;
  onTestDataChange: (data: string) => void;
  onTestHeadersChange: (headers: Record<string, string>) => void;
}) {
  const [showTest, setShowTest] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  const generateWithAI = async () => {
    if (sourceFields.length === 0) return;
    
    setAiLoading(true);
    try {
      // Build source schema from fields
      const properties: Record<string, unknown> = {};
      
      sourceFields.forEach(field => {
        properties[field.name] = {
          type: field.type,
          description: field.description || `Field ${field.name}`,
        };
      });
      
      const response = await aiApi.generateTestData({
        sourceSchema: {
          type: 'object',
          properties,
        },
        description: 'Generate realistic test data for API testing',
        count: 1,
      });
      
      if (response.testData && response.testData.length > 0) {
        onTestDataChange(JSON.stringify(response.testData[0], null, 2));
      }
    } catch (error) {
      console.error('AI generation error:', error);
    } finally {
      setAiLoading(false);
    }
  };
  
  const executeMapping = useCallback((input: Record<string, unknown>, headers: Record<string, string>) => {
    const result: Record<string, unknown> = {};
    
    connections.forEach(conn => {
      try {
        let value: unknown;
        let sourceValue: unknown;
        
        // Get source value from body or headers
        if (conn.sourceType === 'header') {
          // Extract header name from path like "headers.Content-Type"
          const headerName = conn.sourceField.replace('headers.', '');
          sourceValue = headers[headerName] || '';
        } else {
          sourceValue = input[conn.sourceField];
        }
        
        if (conn.transformType === 'direct') {
          value = sourceValue;
        } else if (conn.transformType === 'transform') {
          switch (conn.config?.builtInTransform) {
            case 'uppercase': value = String(sourceValue).toUpperCase(); break;
            case 'lowercase': value = String(sourceValue).toLowerCase(); break;
            case 'trim': value = String(sourceValue).trim(); break;
            case 'toNumber': value = Number(sourceValue); break;
            case 'toString': value = String(sourceValue); break;
            case 'length': value = String(sourceValue).length; break;
            case 'capitalize': 
              value = String(sourceValue).charAt(0).toUpperCase() + String(sourceValue).slice(1).toLowerCase(); 
              break;
            default: value = sourceValue;
          }
        } else {
          value = `[${conn.transformType}]`;
        }
        
        result[conn.targetField] = value;
      } catch {
        result[conn.targetField] = `Error`;
      }
    });
    
    return result;
  }, [connections]);

  let parsedInput: Record<string, unknown> = {};
  let output: Record<string, unknown> = {};
  let parseError = '';
  
  try {
    parsedInput = JSON.parse(testData || '{}');
    output = executeMapping(parsedInput, testHeaders);
  } catch (e) {
    parseError = e instanceof Error ? e.message : 'Invalid JSON';
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Eye size={18} className="text-gray-500 dark:text-gray-400" />
          <h3 className="font-semibold text-gray-800 dark:text-white">Mapping Preview</h3>
          <span className="text-xs bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-2 py-0.5 rounded-full">
            {connections.length} mappings
          </span>
        </div>
        <button
          onClick={() => setShowTest(!showTest)}
          className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 flex items-center gap-1"
        >
          <Play size={14} />
          Test
          <ChevronDown size={14} className={cn('transition-transform', showTest && 'rotate-180')} />
        </button>
      </div>

      {/* Mappings List */}
      <div className="p-4 space-y-3 max-h-[300px] overflow-y-auto">
        {connections.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <Zap size={32} className="mx-auto mb-2 opacity-50" />
            <p>No mappings yet</p>
            <p className="text-sm">Drag source fields to targets</p>
          </div>
        ) : (
          connections.map((conn) => (
            <div
              key={conn.id}
              className="flex items-center gap-3 p-3 rounded-lg border"
              style={{ borderColor: `${conn.color}50`, backgroundColor: `${conn.color}05` }}
            >
              <div 
                className="w-2 h-full min-h-[40px] rounded-full"
                style={{ backgroundColor: conn.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  {conn.sourceType === 'header' && (
                    <span className="text-xs px-1 py-0.5 bg-blue-100 text-blue-600 rounded">HEADER</span>
                  )}
                  <span className="font-medium text-sm" style={{ color: conn.color }}>
                    {conn.sourceField}
                  </span>
                  <ArrowRight size={14} className="text-gray-400" />
                  <span className="font-medium text-sm text-gray-700 dark:text-gray-200">
                    {conn.targetField}
                  </span>
                </div>
                <code 
                  className="text-xs font-mono px-2 py-1 rounded block truncate"
                  style={{ backgroundColor: `${conn.color}15`, color: conn.color }}
                >
                  {conn.formula}
                </code>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onEdit(conn)}
                  className="p-1.5 rounded-lg hover:bg-gray-100"
                  title="Edit"
                >
                  <Edit3 size={14} className="text-gray-500" />
                </button>
                <button
                  onClick={() => onDelete(conn.id)}
                  className="p-1.5 rounded-lg hover:bg-red-100"
                  title="Delete"
                >
                  <Trash2 size={14} className="text-red-400" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Test Panel */}
      {showTest && connections.length > 0 && (
        <div className="border-t dark:border-gray-700">
          {/* Test Headers Section */}
          {headerFields.length > 0 && (
            <div className="p-4 border-b dark:border-gray-700 bg-blue-50 dark:bg-blue-900/20">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                  <Settings2 size={14} className="text-blue-500 dark:text-blue-400" />
                  Test Headers
                </label>
                <button
                  onClick={() => {
                    const sample: Record<string, string> = {};
                    headerFields.forEach(h => {
                      sample[h.name] = h.value || `test-${h.name}`;
                    });
                    onTestHeadersChange(sample);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                >
                  Fill with defaults
                </button>
              </div>
              <div className="space-y-2">
                {headerFields.map(h => (
                  <div key={h.id} className="flex items-center gap-2">
                    <span className="text-xs font-mono text-blue-700 dark:text-blue-400 min-w-[120px] truncate">{h.name}:</span>
                    <input
                      type="text"
                      value={testHeaders[h.name] || ''}
                      onChange={(e) => onTestHeadersChange({ ...testHeaders, [h.name]: e.target.value })}
                      placeholder={h.value || 'header value'}
                      className="flex-1 px-2 py-1 text-xs font-mono border dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 divide-x dark:divide-gray-700">
            {/* Input */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Input (Body)</label>
                <div className="flex items-center gap-2">
                  <button
                    onClick={generateWithAI}
                    disabled={aiLoading || sourceFields.length === 0}
                    className="text-xs text-purple-600 hover:text-purple-700 flex items-center gap-1 disabled:opacity-50"
                    title="Generate realistic test data using AI"
                  >
                    {aiLoading ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Sparkles size={12} />
                    )}
                    AI Generate
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    onClick={() => {
                      const sample: Record<string, unknown> = {};
                      sourceFields.forEach(f => {
                        switch (f.type) {
                          case 'string': sample[f.name] = `sample_${f.name}`; break;
                          case 'number': case 'integer': sample[f.name] = 123; break;
                          case 'boolean': sample[f.name] = true; break;
                          default: sample[f.name] = null;
                        }
                      });
                      onTestDataChange(JSON.stringify(sample, null, 2));
                    }}
                    className="text-xs text-blue-600 hover:text-blue-700"
                  >
                    Sample
                  </button>
                </div>
              </div>
              <textarea
                value={testData}
                onChange={(e) => onTestDataChange(e.target.value)}
                rows={6}
                className={cn(
                  "w-full px-3 py-2 border rounded-lg font-mono text-xs resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                  parseError ? "border-red-300 bg-red-50" : "border-gray-200 dark:border-gray-600"
                )}
                placeholder='{"field": "value"}'
              />
              {parseError && (
                <p className="text-xs text-red-500 mt-1">{parseError}</p>
              )}
            </div>
            
            {/* Output */}
            <div className="p-4 bg-gray-50 dark:bg-gray-900">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Output (Result)</label>
              <pre className="w-full px-3 py-2 bg-gray-900 text-green-400 rounded-lg font-mono text-xs overflow-auto h-[144px]">
                {JSON.stringify(output, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ FORMULA EDITOR MODAL ============
function FormulaEditor({
  connection,
  sourceFields,
  onSave,
  onCancel,
}: {
  connection: MappingConnection;
  sourceFields: SchemaField[];
  onSave: (conn: MappingConnection) => void;
  onCancel: () => void;
}) {
  const [editedConn, setEditedConn] = useState<MappingConnection>({ ...connection });

  const builtInTransforms = [
    { value: 'toString', label: 'To String', example: '123 → "123"' },
    { value: 'toNumber', label: 'To Number', example: '"123" → 123' },
    { value: 'uppercase', label: 'Uppercase', example: '"hello" → "HELLO"' },
    { value: 'lowercase', label: 'Lowercase', example: '"HELLO" → "hello"' },
    { value: 'trim', label: 'Trim', example: '" hi " → "hi"' },
    { value: 'capitalize', label: 'Capitalize', example: '"hello" → "Hello"' },
    { value: 'length', label: 'Length', example: '"hello" → 5' },
  ];

  const updateType = (type: MappingConnection['transformType']) => {
    let formula = `source.${editedConn.sourceField}`;
    if (type === 'transform' && editedConn.config?.builtInTransform) {
      formula = `${editedConn.config.builtInTransform}(source.${editedConn.sourceField})`;
    }
    setEditedConn({ ...editedConn, transformType: type, formula });
  };

  const updateTransform = (fn: string) => {
    setEditedConn({
      ...editedConn,
      config: { ...editedConn.config, builtInTransform: fn },
      formula: `${fn}(source.${editedConn.sourceField})`,
    });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden"
        style={{ borderTop: `4px solid ${connection.color}` }}
      >
        <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold dark:text-white">Edit Mapping</h2>
            <div className="flex items-center gap-2 mt-1">
              <span 
                className="text-sm px-2 py-0.5 rounded"
                style={{ backgroundColor: `${connection.color}20`, color: connection.color }}
              >
                {editedConn.sourceField}
              </span>
              <ArrowRight size={14} className="text-gray-400" />
              <span className="text-sm font-medium dark:text-gray-200">{editedConn.targetField}</span>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg dark:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Transform Type */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Type</label>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'direct' as const, label: 'Direct Copy' },
                { type: 'transform' as const, label: 'Transform' },
                { type: 'formula' as const, label: 'Custom Formula' },
                { type: 'conditional' as const, label: 'Conditional' },
              ].map((t) => (
                <button
                  key={t.type}
                  onClick={() => updateType(t.type)}
                  className={cn(
                    'p-3 rounded-lg border text-sm font-medium transition-all dark:text-gray-200',
                    editedConn.transformType === t.type
                      ? 'border-2'
                      : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                  )}
                  style={editedConn.transformType === t.type ? {
                    borderColor: connection.color,
                    backgroundColor: `${connection.color}10`,
                    color: connection.color,
                  } : {}}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Built-in transforms */}
          {editedConn.transformType === 'transform' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Function</label>
              <div className="grid grid-cols-2 gap-2">
                {builtInTransforms.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => updateTransform(t.value)}
                    className={cn(
                      'p-2 rounded-lg border text-left transition-all dark:text-gray-200',
                      editedConn.config?.builtInTransform === t.value
                        ? 'border-2'
                        : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                    )}
                    style={editedConn.config?.builtInTransform === t.value ? {
                      borderColor: connection.color,
                      backgroundColor: `${connection.color}10`,
                    } : {}}
                  >
                    <div className="font-medium text-sm">{t.label}</div>
                    <div className="text-xs text-gray-400 font-mono">{t.example}</div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Formula */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Formula</label>
            <textarea
              value={editedConn.formula}
              onChange={(e) => setEditedConn({ ...editedConn, formula: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border-2 rounded-lg font-mono text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              style={{ borderColor: `${connection.color}50` }}
            />
            <div className="flex flex-wrap gap-1 mt-2">
              {sourceFields.slice(0, 4).map(f => (
                <button
                  key={f.path}
                  onClick={() => setEditedConn(prev => ({
                    ...prev,
                    formula: prev.formula + `source.${f.path}`
                  }))}
                  className="text-xs px-2 py-1 rounded hover:opacity-80"
                  style={{ backgroundColor: `${getFieldColor(f.path!)}20`, color: getFieldColor(f.path!) }}
                >
                  {f.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
            Cancel
          </button>
          <button
            onClick={() => onSave(editedConn)}
            className="px-4 py-2 text-white rounded-lg flex items-center gap-2"
            style={{ backgroundColor: connection.color }}
          >
            <Check size={16} />
            Save
          </button>
        </div>
      </div>
    </div>
  );
}

// ============ VALIDATION EDITOR MODAL ============
function ValidationEditor({
  connection,
  onSave,
  onCancel,
}: {
  connection: MappingConnection;
  onSave: (conn: MappingConnection) => void;
  onCancel: () => void;
}) {
  const [rules, setRules] = useState<ValidationRule[]>(
    connection.validation || []
  );

  const validationTypes = [
    { type: 'required', label: 'Required', description: 'Field must have a value', hasValue: false },
    { type: 'minLength', label: 'Min Length', description: 'Minimum string length', hasValue: true, valueType: 'number' },
    { type: 'maxLength', label: 'Max Length', description: 'Maximum string length', hasValue: true, valueType: 'number' },
    { type: 'min', label: 'Min Value', description: 'Minimum numeric value', hasValue: true, valueType: 'number' },
    { type: 'max', label: 'Max Value', description: 'Maximum numeric value', hasValue: true, valueType: 'number' },
    { type: 'pattern', label: 'Pattern (Regex)', description: 'Match regex pattern', hasValue: true, valueType: 'string' },
    { type: 'email', label: 'Email', description: 'Valid email format', hasValue: false },
    { type: 'url', label: 'URL', description: 'Valid URL format', hasValue: false },
    { type: 'enum', label: 'Enum', description: 'One of allowed values (comma separated)', hasValue: true, valueType: 'string' },
    { type: 'custom', label: 'Custom', description: 'Custom validation expression', hasValue: true, valueType: 'string' },
  ] as const;

  const addRule = (type: ValidationRule['type']) => {
    const config = validationTypes.find(v => v.type === type);
    setRules([...rules, {
      id: generateId(),
      type,
      value: config?.hasValue ? '' : undefined,
      message: `Invalid ${type}`,
      enabled: true,
    }]);
  };

  const updateRule = (id: string, updates: Partial<ValidationRule>) => {
    setRules(rules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const removeRule = (id: string) => {
    setRules(rules.filter(r => r.id !== id));
  };

  const handleSave = () => {
    onSave({ ...connection, validation: rules });
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        style={{ borderTop: `4px solid ${connection.color}` }}
      >
        <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <Shield size={20} className="text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-lg font-semibold dark:text-white">Validation Rules</h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm text-gray-500 dark:text-gray-400">Target:</span>
                <span 
                  className="text-sm px-2 py-0.5 rounded font-medium"
                  style={{ backgroundColor: `${connection.color}20`, color: connection.color }}
                >
                  {connection.targetField}
                </span>
              </div>
            </div>
          </div>
          <button onClick={onCancel} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg dark:text-gray-300">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {/* Add New Rule */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Add Validation Rule</label>
            <div className="grid grid-cols-5 gap-2">
              {validationTypes.map((v) => (
                <button
                  key={v.type}
                  onClick={() => addRule(v.type)}
                  disabled={rules.some(r => r.type === v.type)}
                  className={cn(
                    'p-2 rounded-lg border text-xs font-medium transition-all text-center dark:border-gray-600',
                    rules.some(r => r.type === v.type)
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 dark:text-gray-500 cursor-not-allowed'
                      : 'hover:border-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 text-gray-700 dark:text-gray-300'
                  )}
                >
                  {v.label}
                </button>
              ))}
            </div>
          </div>

          {/* Rules List */}
          <div className="space-y-3">
            {rules.length === 0 ? (
              <div className="text-center py-8 text-gray-400">
                <Shield size={32} className="mx-auto mb-2 opacity-50" />
                <p>No validation rules</p>
                <p className="text-sm">Click a rule type above to add</p>
              </div>
            ) : (
              rules.map((rule) => {
                const config = validationTypes.find(v => v.type === rule.type);
                return (
                  <div
                    key={rule.id}
                    className={cn(
                      'border rounded-lg overflow-hidden transition-all',
                      rule.enabled ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/20' : 'border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
                    )}
                  >
                    <div className="flex items-center gap-3 px-4 py-3">
                      <input
                        type="checkbox"
                        checked={rule.enabled}
                        onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                        className="w-4 h-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            'font-medium text-sm',
                            rule.enabled ? 'text-green-700' : 'text-gray-500'
                          )}>
                            {config?.label}
                          </span>
                          <span className="text-xs text-gray-400">{config?.description}</span>
                        </div>
                      </div>
                      <button
                        onClick={() => removeRule(rule.id)}
                        className="p-1.5 text-red-500 hover:bg-red-100 rounded"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    
                    <div className="px-4 pb-3 pt-0 space-y-2">
                      {config?.hasValue && (
                        <div>
                          <label className="text-xs text-gray-500 mb-1 block">Value</label>
                          <input
                            type={config.valueType === 'number' ? 'number' : 'text'}
                            value={rule.value || ''}
                            onChange={(e) => updateRule(rule.id, { 
                              value: config.valueType === 'number' ? Number(e.target.value) : e.target.value 
                            })}
                            placeholder={
                              rule.type === 'pattern' ? '^[a-zA-Z]+$' :
                              rule.type === 'enum' ? 'value1, value2, value3' :
                              rule.type === 'custom' ? 'value.length > 5' :
                              'Enter value...'
                            }
                            className="w-full px-3 py-1.5 border rounded text-sm font-mono"
                          />
                        </div>
                      )}
                      <div>
                        <label className="text-xs text-gray-500 mb-1 block">Error Message</label>
                        <input
                          type="text"
                          value={rule.message}
                          onChange={(e) => updateRule(rule.id, { message: e.target.value })}
                          placeholder="Error message..."
                          className="w-full px-3 py-1.5 border rounded text-sm"
                        />
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {rules.filter(r => r.enabled).length} of {rules.length} rules enabled
          </span>
          <div className="flex gap-3">
            <button onClick={onCancel} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg">
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
            >
              <Check size={16} />
              Save Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============ MAIN COMPONENT ============
export default function TransformDetailPage() {
  const { id: workflowId, nodeId } = useParams<{ id: string; nodeId: string }>();
  const navigate = useNavigate();
  
  const mappingAreaRef = useRef<HTMLDivElement>(null);
  const sourceRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const targetRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  
  const [sourceSchemaId, setSourceSchemaId] = useState<string>('');
  const [targetSchemaId, setTargetSchemaId] = useState<string>('');
  const [connections, setConnections] = useState<MappingConnection[]>([]);
  const [editingConnection, setEditingConnection] = useState<MappingConnection | null>(null);
  const [activeField, setActiveField] = useState<SchemaField | null>(null);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [positions, setPositions] = useState<{
    source: Record<string, { x: number; y: number }>;
    target: Record<string, { x: number; y: number }>;
  }>({ source: {}, target: {} });
  const [testData, setTestData] = useState('{}');
  const [testHeaders, setTestHeaders] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState<'source' | 'target' | null>(null);
  const [importJson, setImportJson] = useState('');
  const [importSchemaName, setImportSchemaName] = useState('');
  const [importError, setImportError] = useState('');
  const [customSchemas, setCustomSchemas] = useState<Array<{
    id: string;
    name: string;
    fields: SchemaField[];
  }>>([]);
  const [activeTab, setActiveTab] = useState<'body' | 'headers'>('body');
  const [headerFields, setHeaderFields] = useState<HeaderField[]>([
    { id: '1', name: 'Content-Type', value: 'application/json', type: 'string', path: 'headers.Content-Type' },
    { id: '2', name: 'Authorization', value: 'Bearer token', type: 'string', path: 'headers.Authorization' },
    { id: '3', name: 'X-Request-ID', value: '', type: 'string', path: 'headers.X-Request-ID' },
  ]);
  const [showValidationModal, setShowValidationModal] = useState<MappingConnection | null>(null);
  
  // AI Suggest states
  const [showAIModal, setShowAIModal] = useState(false);
  const [aiConfig, setAIConfig] = useState<AIConfig>(() => {
    const saved = localStorage.getItem('ai-mapping-config');
    return saved ? JSON.parse(saved) : {
      provider: 'openai',
      model: 'gpt-4o-mini',
      apiKey: '',
      baseUrl: '',
      temperature: 0.3,
    };
  });
  const [aiSuggestions, setAISuggestions] = useState<AISuggestion[]>([]);
  const [isAILoading, setIsAILoading] = useState(false);
  const [aiError, setAIError] = useState('');

  // DnD sensors
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  // Load schemas from API
  const { data: schemasData, isLoading } = useQuery({
    queryKey: ['schemas'],
    queryFn: () => schemasApi.list(),
  });

  const schemas = schemasData?.data || [];

  // Load saved node configuration
  useEffect(() => {
    const loadNodeConfig = async () => {
      if (!workflowId || !nodeId) {
        setIsLoadingConfig(false);
        return;
      }
      
      try {
        const savedConfig = await nodeSchemaApi.get(workflowId, nodeId);
        
        if (savedConfig) {
          // Restore source schema
          if (savedConfig.sourceSchema) {
            const existingSource = schemas.find(s => s.id === savedConfig.sourceSchema?.id);
            if (existingSource) {
              setSourceSchemaId(existingSource.id);
            } else {
              // Add as custom schema
              setCustomSchemas(prev => {
                const exists = prev.find(s => s.id === savedConfig.sourceSchema?.id);
                if (exists) return prev;
                return [...prev, savedConfig.sourceSchema as { id: string; name: string; fields: SchemaField[] }];
              });
              setSourceSchemaId(savedConfig.sourceSchema.id);
            }
          }
          
          // Restore target schema
          if (savedConfig.targetSchema) {
            const existingTarget = schemas.find(s => s.id === savedConfig.targetSchema?.id);
            if (existingTarget) {
              setTargetSchemaId(existingTarget.id);
            } else {
              // Add as custom schema
              setCustomSchemas(prev => {
                const exists = prev.find(s => s.id === savedConfig.targetSchema?.id);
                if (exists) return prev;
                return [...prev, savedConfig.targetSchema as { id: string; name: string; fields: SchemaField[] }];
              });
              setTargetSchemaId(savedConfig.targetSchema.id);
            }
          }
          
          // Restore connections
          if (savedConfig.connections && savedConfig.connections.length > 0) {
            setConnections(savedConfig.connections as MappingConnection[]);
          }
          
          // Restore header fields
          if (savedConfig.headerFields && savedConfig.headerFields.length > 0) {
            setHeaderFields(savedConfig.headerFields as HeaderField[]);
          }
        }
      } catch (error) {
        console.error('Failed to load node configuration:', error);
      } finally {
        setIsLoadingConfig(false);
      }
    };
    
    if (!isLoading) {
      loadNodeConfig();
    }
  }, [workflowId, nodeId, schemas, isLoading]);

  // Combine API schemas with custom imported schemas
  const allSchemas = useMemo(() => [...schemas, ...customSchemas], [schemas, customSchemas]);
  const sourceSchema = allSchemas.find(s => s.id === sourceSchemaId);
  const targetSchema = allSchemas.find(s => s.id === targetSchemaId);

  const sourceFields = useMemo(() => sourceSchema?.fields ? flattenFields(sourceSchema.fields) : [], [sourceSchema]);
  const targetFields = useMemo(() => targetSchema?.fields ? flattenFields(targetSchema.fields) : [], [targetSchema]);

  // Field colors
  const fieldColors = useMemo(() => {
    const colors: Record<string, string> = {};
    [...sourceFields, ...targetFields].forEach(f => {
      if (f.path) colors[f.path] = getFieldColor(f.path);
    });
    // Add header field colors
    headerFields.forEach(h => {
      colors[h.path] = getFieldColor(h.path);
    });
    return colors;
  }, [sourceFields, targetFields, headerFields]);

  // Connection lookup
  const connectionByTarget = useMemo(() => {
    const map: Record<string, MappingConnection> = {};
    connections.forEach(c => { map[c.targetField] = c; });
    return map;
  }, [connections]);

  const connectedSources = useMemo(() => new Set(connections.map(c => c.sourceField)), [connections]);

  // Parse JSON to schema fields
  const parseJsonToFields = useCallback((obj: unknown, parentPath = ''): SchemaField[] => {
    if (typeof obj !== 'object' || obj === null) return [];
    
    return Object.entries(obj as Record<string, unknown>).map(([key, value]) => {
      const path = parentPath ? `${parentPath}.${key}` : key;
      let type: string;
      let children: SchemaField[] | undefined;
      
      if (Array.isArray(value)) {
        type = 'array';
        if (value.length > 0 && typeof value[0] === 'object') {
          children = parseJsonToFields(value[0], path);
        }
      } else if (typeof value === 'object' && value !== null) {
        type = 'object';
        children = parseJsonToFields(value, path);
      } else if (typeof value === 'number') {
        type = Number.isInteger(value) ? 'integer' : 'number';
      } else if (typeof value === 'boolean') {
        type = 'boolean';
      } else {
        type = 'string';
      }
      
      return {
        name: key,
        type,
        path,
        description: '',
        required: false,
        children,
      };
    });
  }, []);

  // Handle import schema
  const handleImportSchema = useCallback(() => {
    setImportError('');
    try {
      const parsed = JSON.parse(importJson);
      const fields = parseJsonToFields(parsed);
      
      if (fields.length === 0) {
        setImportError('No fields found in JSON');
        return;
      }
      
      const schemaName = importSchemaName.trim() || `Imported Schema ${customSchemas.length + 1}`;
      const newSchema = {
        id: `custom-${generateId()}`,
        name: schemaName,
        fields,
      };
      
      setCustomSchemas([...customSchemas, newSchema]);
      
      if (showImportModal === 'source') {
        setSourceSchemaId(newSchema.id);
      } else {
        setTargetSchemaId(newSchema.id);
      }
      
      setShowImportModal(null);
      setImportJson('');
      setImportSchemaName('');
    } catch (e) {
      setImportError(e instanceof Error ? e.message : 'Invalid JSON');
    }
  }, [importJson, importSchemaName, showImportModal, customSchemas, parseJsonToFields]);

  // Handle file upload
  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      setImportJson(content);
      setImportError('');
    };
    reader.readAsText(file);
  }, []);

  // Calculate positions for SVG lines
  const updatePositions = useCallback(() => {
    if (!mappingAreaRef.current) return;
    const areaRect = mappingAreaRef.current.getBoundingClientRect();
    const newPositions: typeof positions = { source: {}, target: {} };
    
    sourceRefs.current.forEach((el, path) => {
      const rect = el.getBoundingClientRect();
      // Point from right edge of source field, centered vertically
      newPositions.source[path] = {
        x: rect.right - areaRect.left,
        y: rect.top - areaRect.top + rect.height / 2,
      };
    });
    
    targetRefs.current.forEach((el, path) => {
      const rect = el.getBoundingClientRect();
      // Point to left edge of target field, centered vertically
      newPositions.target[path] = {
        x: rect.left - areaRect.left,
        y: rect.top - areaRect.top + rect.height / 2,
      };
    });
    
    setPositions(newPositions);
  }, []);

  useLayoutEffect(() => {
    updatePositions();
    window.addEventListener('resize', updatePositions);
    const timer = setTimeout(updatePositions, 100);
    return () => {
      window.removeEventListener('resize', updatePositions);
      clearTimeout(timer);
    };
  }, [updatePositions, sourceFields, targetFields, connections, headerFields]);

  // DnD handlers
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    const field = active.data.current?.field as SchemaField;
    setActiveField(field);
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveField(null);
    
    if (!over || !active.data.current || !over.data.current) return;
    
    const sourceField = active.data.current.field as SchemaField;
    const targetField = over.data.current.field as SchemaField;
    
    if (active.data.current.type !== 'source' || over.data.current.type !== 'target') return;
    
    // Check if target already has a connection
    if (connectionByTarget[targetField.path!]) return;
    
    const color = fieldColors[sourceField.path!] || FIELD_COLORS[0];
    const sourceType = active.data.current.sourceType as 'body' | 'header' | undefined;
    const newConn: MappingConnection = {
      id: generateId(),
      sourceField: sourceField.path!,
      targetField: targetField.path!,
      formula: sourceType === 'header' 
        ? `headers["${sourceField.name}"]` 
        : `source.${sourceField.path}`,
      transformType: 'direct',
      color,
      sourceType: sourceType || 'body',
      validation: [],
    };
    
    setConnections([...connections, newConn]);
    setTimeout(updatePositions, 50);
  };

  const handleDeleteConnection = (id: string) => {
    setConnections(connections.filter(c => c.id !== id));
  };

  const handleSaveFormula = (updated: MappingConnection) => {
    setConnections(connections.map(c => c.id === updated.id ? updated : c));
    setEditingConnection(null);
  };

  const handleSaveValidation = (updated: MappingConnection) => {
    setConnections(connections.map(c => c.id === updated.id ? updated : c));
    setShowValidationModal(null);
  };

  // Generate AI suggestions
  const generateAISuggestions = useCallback(async () => {
    if (sourceFields.length === 0 || targetFields.length === 0) {
      setAIError('Please select source and target schemas first');
      return;
    }

    // Save config to localStorage
    localStorage.setItem('ai-mapping-config', JSON.stringify(aiConfig));
    
    setIsAILoading(true);
    setAIError('');
    setAISuggestions([]);
    
    try {
      const provider = AI_PROVIDERS.find(p => p.id === aiConfig.provider);
      if (!provider) throw new Error('Provider not found');
      
      // Build prompt
      const prompt = `You are a data mapping expert. Analyze these source and target fields and suggest the best mappings.

Source Fields:
${sourceFields.map(f => `- ${f.path} (${f.type})`).join('\n')}

Target Fields:
${targetFields.map(f => `- ${f.path} (${f.type})`).join('\n')}

For each target field, suggest the best source field to map from. Consider:
1. Field name similarity
2. Type compatibility
3. Semantic meaning

Respond ONLY with a JSON array in this exact format:
[
  {
    "sourceField": "source.field.path",
    "targetField": "target.field.path",
    "confidence": 0.95,
    "reason": "Brief explanation",
    "transformType": "direct",
    "formula": "source.field.path"
  }
]

transformType can be: "direct", "transform", "formula"
If type conversion is needed, use transformType: "transform" and set formula like "toString(source.field)" or "toNumber(source.field)"`;

      let response: Response;
      let result: { suggestions?: AISuggestion[] };
      
      if (provider.type === 'local') {
        const baseUrl = aiConfig.baseUrl || provider.baseUrl || '';
        
        if (provider.id === 'ollama') {
          response = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: aiConfig.model,
              prompt,
              stream: false,
              format: 'json',
            }),
          });
          const data = await response.json();
          const parsed = JSON.parse(data.response);
          result = { suggestions: Array.isArray(parsed) ? parsed : parsed.suggestions || [] };
        } else {
          // OpenAI-compatible API (LM Studio, etc.)
          response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: aiConfig.model,
              messages: [{ role: 'user', content: prompt }],
              temperature: aiConfig.temperature,
            }),
          });
          const data = await response.json();
          const content = data.choices[0]?.message?.content || '[]';
          const parsed = JSON.parse(content);
          result = { suggestions: Array.isArray(parsed) ? parsed : parsed.suggestions || [] };
        }
      } else {
        // Cloud providers - simulate for now (would need backend proxy for CORS)
        // In production, this should call your backend API
        await new Promise(r => setTimeout(r, 1500));
        
        // Generate smart suggestions based on field name matching
        const suggestions: AISuggestion[] = [];
        for (const target of targetFields) {
          const targetName = target.name.toLowerCase();
          let bestMatch: SchemaField | undefined;
          let bestScore = 0;
          
          for (const source of sourceFields) {
            const sourceName = source.name.toLowerCase();
            let score = 0;
            
            // Exact match
            if (sourceName === targetName) score = 1;
            // Contains match
            else if (sourceName.includes(targetName) || targetName.includes(sourceName)) score = 0.8;
            // Similar names (email, user_email, userEmail)
            else if (sourceName.replace(/[_-]/g, '') === targetName.replace(/[_-]/g, '')) score = 0.9;
            // Type match bonus
            if (source.type === target.type) score += 0.1;
            
            if (score > bestScore) {
              bestScore = score;
              bestMatch = source;
            }
          }
          
          if (bestMatch && bestScore > 0.5) {
            const needsTransform = bestMatch.type !== target.type;
            suggestions.push({
              sourceField: bestMatch.path!,
              targetField: target.path!,
              confidence: Math.min(bestScore, 1),
              reason: bestScore === 1 ? 'Exact name match' : 
                      bestScore >= 0.9 ? 'Very similar names' :
                      'Similar field names',
              transformType: needsTransform ? 'transform' : 'direct',
              formula: needsTransform 
                ? `to${target.type.charAt(0).toUpperCase() + target.type.slice(1)}(source.${bestMatch.path})`
                : `source.${bestMatch.path}`,
            });
          }
        }
        
        result = { suggestions };
      }
      
      setAISuggestions(result.suggestions || []);
    } catch (error) {
      setAIError(error instanceof Error ? error.message : 'Failed to generate suggestions');
    } finally {
      setIsAILoading(false);
    }
  }, [sourceFields, targetFields, aiConfig]);

  // Apply AI suggestion
  const applyAISuggestion = useCallback((suggestion: AISuggestion) => {
    if (connectionByTarget[suggestion.targetField]) return;
    
    const color = fieldColors[suggestion.sourceField] || FIELD_COLORS[0];
    const newConn: MappingConnection = {
      id: generateId(),
      sourceField: suggestion.sourceField,
      targetField: suggestion.targetField,
      formula: suggestion.formula,
      transformType: suggestion.transformType,
      color,
      sourceType: 'body',
      validation: [],
    };
    
    setConnections([...connections, newConn]);
    setAISuggestions(aiSuggestions.filter(s => s.targetField !== suggestion.targetField));
    setTimeout(updatePositions, 50);
  }, [connections, connectionByTarget, fieldColors, aiSuggestions, updatePositions]);

  // Apply all AI suggestions
  const applyAllSuggestions = useCallback(() => {
    const newConnections = aiSuggestions
      .filter(s => !connectionByTarget[s.targetField])
      .map(suggestion => ({
        id: generateId(),
        sourceField: suggestion.sourceField,
        targetField: suggestion.targetField,
        formula: suggestion.formula,
        transformType: suggestion.transformType,
        color: fieldColors[suggestion.sourceField] || FIELD_COLORS[0],
        sourceType: 'body' as const,
        validation: [],
      }));
    
    setConnections([...connections, ...newConnections]);
    setAISuggestions([]);
    setShowAIModal(false);
    setTimeout(updatePositions, 50);
  }, [aiSuggestions, connections, connectionByTarget, fieldColors, updatePositions]);

  const handleSave = async () => {
    if (!workflowId || !nodeId) {
      console.error('Missing workflowId or nodeId');
      return;
    }
    
    setIsSaving(true);
    try {
      // Prepare source and target schema data for saving
      const sourceSchemaData = sourceSchema ? {
        id: sourceSchema.id,
        name: sourceSchema.name,
        fields: sourceSchema.fields,
      } : null;
      
      const targetSchemaData = targetSchema ? {
        id: targetSchema.id,
        name: targetSchema.name,
        fields: targetSchema.fields,
      } : null;
      
      // Save to backend API
      await nodeSchemaApi.save(workflowId, nodeId, {
        sourceSchema: sourceSchemaData,
        targetSchema: targetSchemaData,
        connections: connections.map(c => ({
          id: c.id,
          sourceField: c.sourceField,
          targetField: c.targetField,
          formula: c.formula,
          transformType: c.transformType,
          color: c.color,
          sourceType: c.sourceType,
          config: c.config,
          validation: c.validation,
        })),
        headerFields: headerFields.map(h => ({
          id: h.id,
          name: h.name,
          value: h.value,
          type: h.type,
          path: h.path,
        })),
      });
      
      console.log('Saved successfully!');
      navigate(`/workflows/${workflowId}`);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save configuration. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading || isLoadingConfig) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
        {/* Header */}
        <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
          <div className="flex items-center gap-4">
            <Link to={`/workflows/${workflowId}`} className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-lg font-semibold dark:text-white">Transform Mapping</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">Drag source fields to target fields to create mappings</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowAIModal(true)}
              disabled={!sourceSchema || !targetSchema}
              className="flex items-center gap-2 px-4 py-2 text-purple-600 hover:bg-purple-50 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Wand2 size={16} />
              AI Suggest
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              {isSaving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save
            </button>
          </div>
        </header>

        {/* Schema Selection */}
        <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4 flex-shrink-0">
          <div className="flex gap-6 items-end">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source Schema</label>
              <div className="flex gap-2">
                <select
                  value={sourceSchemaId}
                  onChange={(e) => setSourceSchemaId(e.target.value)}
                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select source schema...</option>
                  <optgroup label="Predefined Schemas">
                    {schemas.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                  {customSchemas.length > 0 && (
                    <optgroup label="Imported Schemas">
                      {customSchemas.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  onClick={() => setShowImportModal('source')}
                  className="px-3 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-1"
                  title="Import from JSON"
                >
                  <Upload size={16} />
                  <span className="hidden sm:inline">Import</span>
                </button>
              </div>
            </div>
            <ArrowRight size={24} className="text-gray-400 mb-2" />
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Target Schema</label>
              <div className="flex gap-2">
                <select
                  value={targetSchemaId}
                  onChange={(e) => setTargetSchemaId(e.target.value)}
                  className="flex-1 px-3 py-2 border dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select target schema...</option>
                  <optgroup label="Predefined Schemas">
                    {schemas.map((s) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                  </optgroup>
                  {customSchemas.length > 0 && (
                    <optgroup label="Imported Schemas">
                      {customSchemas.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </optgroup>
                  )}
                </select>
                <button
                  onClick={() => setShowImportModal('target')}
                  className="px-3 py-2 border dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 flex items-center gap-1"
                  title="Import from JSON"
                >
                  <Upload size={16} />
                  <span className="hidden sm:inline">Import</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Mapping Area */}
          <div ref={mappingAreaRef} className="flex-1 flex relative">
            {/* Source Panel */}
            <div className="w-80 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col flex-shrink-0">
              {/* Tabs */}
              <div className="flex border-b dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('body')}
                  className={cn(
                    'flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    activeTab === 'body'
                      ? 'text-green-600 dark:text-green-400 border-b-2 border-green-600 dark:border-green-400 bg-green-50 dark:bg-green-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  <FileText size={16} />
                  Body Fields
                </button>
                <button
                  onClick={() => setActiveTab('headers')}
                  className={cn(
                    'flex-1 px-4 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-2',
                    activeTab === 'headers'
                      ? 'text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 dark:border-blue-400 bg-blue-50 dark:bg-blue-900/20'
                      : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                  )}
                >
                  <Settings2 size={16} />
                  Headers
                </button>
              </div>
              
              {/* Body Fields Tab */}
              {activeTab === 'body' && (
                <>
                  <div className="px-4 py-3 border-b dark:border-gray-700 bg-gradient-to-r from-green-50 dark:from-green-900/20 to-white dark:to-gray-800 flex-shrink-0">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200">Source Fields</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{sourceFields.length} fields • Drag to map</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2" onScroll={() => requestAnimationFrame(updatePositions)}>
                    {sourceFields.length === 0 ? (
                      <div className="text-center text-gray-400 py-8">
                        <AlertCircle size={24} className="mx-auto mb-2" />
                        <p className="text-sm">Select a source schema</p>
                      </div>
                    ) : (
                      sourceFields.map((field) => (
                        <div
                          key={field.path}
                          ref={(el) => { if (el) sourceRefs.current.set(field.path!, el); }}
                        >
                          <DraggableField
                            field={field}
                            color={fieldColors[field.path!] || '#666'}
                            isConnected={connectedSources.has(field.path!)}
                          />
                        </div>
                      ))
                    )}
                  </div>
                </>
              )}
              
              {/* Headers Tab */}
              {activeTab === 'headers' && (
                <>
                  <div className="px-4 py-3 border-b dark:border-gray-700 bg-gradient-to-r from-blue-50 dark:from-blue-900/20 to-white dark:to-gray-800 flex-shrink-0 flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-700 dark:text-gray-200">Request Headers</h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400">{headerFields.length} headers • Drag to map</p>
                    </div>
                    <button
                      onClick={() => setHeaderFields([...headerFields, {
                        id: generateId(),
                        name: '',
                        value: '',
                        type: 'string',
                        path: `headers.new-${Date.now()}`,
                      }])}
                      className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg"
                      title="Add Header"
                    >
                      <Plus size={16} />
                    </button>
                  </div>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {headerFields.map((header) => (
                      <div
                        key={header.id}
                        ref={(el) => { if (el) sourceRefs.current.set(header.path, el); }}
                      >
                        <DraggableHeaderField
                          header={header}
                          onUpdate={(updates) => setHeaderFields(headerFields.map(h => 
                            h.id === header.id ? { ...h, ...updates } : h
                          ))}
                          onRemove={() => setHeaderFields(headerFields.filter(h => h.id !== header.id))}
                          isConnected={connectedSources.has(header.path)}
                        />
                      </div>
                    ))}
                    
                    {/* Common Headers Quick Add */}
                    <div className="pt-3 border-t mt-3">
                      <p className="text-xs text-gray-500 mb-2">Quick Add:</p>
                      <div className="flex flex-wrap gap-1">
                        {['X-API-Key', 'X-Correlation-ID', 'Accept', 'User-Agent'].map(name => (
                          <button
                            key={name}
                            onClick={() => {
                              if (!headerFields.some(h => h.name === name)) {
                                setHeaderFields([...headerFields, {
                                  id: generateId(),
                                  name,
                                  value: '',
                                  type: 'string',
                                  path: `headers.${name}`,
                                }]);
                              }
                            }}
                            disabled={headerFields.some(h => h.name === name)}
                            className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600 hover:bg-gray-200 disabled:opacity-50"
                          >
                            + {name}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>

            {/* SVG Canvas - overlay toàn bộ mapping area */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none z-10"
              style={{ overflow: 'visible' }}
            >
              <defs>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
                  <feMerge>
                    <feMergeNode in="coloredBlur"/>
                    <feMergeNode in="SourceGraphic"/>
                  </feMerge>
                </filter>
                {/* Arrow marker */}
                {connections.map((conn) => (
                  <marker
                    key={`marker-${conn.id}`}
                    id={`arrow-${conn.id}`}
                    viewBox="0 0 10 10"
                    refX="9"
                    refY="5"
                    markerWidth="6"
                    markerHeight="6"
                    orient="auto-start-reverse"
                  >
                    <path d="M 0 0 L 10 5 L 0 10 z" fill={conn.color} />
                  </marker>
                ))}
              </defs>
              {connections.map((conn) => {
                const sourcePos = positions.source[conn.sourceField];
                const targetPos = positions.target[conn.targetField];
                if (!sourcePos || !targetPos) return null;
                
                const startX = sourcePos.x;
                const startY = sourcePos.y;
                const endX = targetPos.x;
                const endY = targetPos.y;
                
                // Tính control points cho bezier curve mượt
                const dx = endX - startX;
                const ctrlOffset = Math.max(50, Math.min(150, Math.abs(dx) * 0.4));
                
                const path = `M ${startX} ${startY} C ${startX + ctrlOffset} ${startY}, ${endX - ctrlOffset} ${endY}, ${endX} ${endY}`;
                const midX = (startX + endX) / 2;
                const midY = (startY + endY) / 2;
                
                return (
                  <g key={conn.id}>
                    {/* Glow effect */}
                    <path
                      d={path}
                      fill="none"
                      stroke={conn.color}
                      strokeWidth={8}
                      opacity={0.15}
                      filter="url(#glow)"
                    />
                    {/* Main line */}
                    <path
                      d={path}
                      fill="none"
                      stroke={conn.color}
                      strokeWidth={3}
                      strokeLinecap="round"
                      markerEnd={`url(#arrow-${conn.id})`}
                    />
                    {/* Start dot */}
                    <circle cx={startX} cy={startY} r="5" fill={conn.color} />
                    {/* Animated dot */}
                    <circle r="4" fill="white" stroke={conn.color} strokeWidth="2">
                      <animateMotion dur="2s" repeatCount="indefinite" path={path} />
                    </circle>
                    {/* Formula label */}
                    <g transform={`translate(${midX}, ${midY})`}>
                      <rect
                        x="-40"
                        y="-12"
                        width="80"
                        height="24"
                        rx="12"
                        fill="white"
                        stroke={conn.color}
                        strokeWidth="1.5"
                      />
                      <text
                        textAnchor="middle"
                        dominantBaseline="central"
                        fill={conn.color}
                        fontSize="10"
                        fontWeight="500"
                        fontFamily="monospace"
                      >
                        {conn.transformType === 'direct' ? 'direct' : conn.config?.builtInTransform || conn.transformType}
                      </text>
                    </g>
                  </g>
                );
              })}
            </svg>
            
            {/* Center area with hint */}
            <div className="flex-1 relative bg-gradient-to-r from-gray-50 dark:from-gray-800 via-white dark:via-gray-800/50 to-gray-50 dark:to-gray-800 min-w-[100px]">
              
              {/* Drop hint */}
              {sourceFields.length > 0 && targetFields.length > 0 && connections.length === 0 && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="bg-white dark:bg-gray-700 rounded-xl px-6 py-4 shadow-lg border dark:border-gray-600 text-center">
                    <GripVertical className="mx-auto text-gray-300 dark:text-gray-500 mb-2" size={32} />
                    <p className="font-medium text-gray-700 dark:text-gray-200">Drag & Drop</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">to create mappings</p>
                  </div>
                </div>
              )}
            </div>

            {/* Target Panel */}
            <div className="w-80 bg-white dark:bg-gray-800 border-l dark:border-gray-700 flex flex-col flex-shrink-0">
              <div className="px-4 py-3 border-b dark:border-gray-700 bg-gradient-to-l from-blue-50 dark:from-blue-900/20 to-white dark:to-gray-800 flex-shrink-0">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200">Target Fields</h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">{targetFields.length} fields • Drop here</p>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2" onScroll={() => requestAnimationFrame(updatePositions)}>
                {targetFields.length === 0 ? (
                  <div className="text-center text-gray-400 py-8">
                    <AlertCircle size={24} className="mx-auto mb-2" />
                    <p className="text-sm">Select a target schema</p>
                  </div>
                ) : (
                  targetFields.map((field) => (
                    <div
                      key={field.path}
                      ref={(el) => { if (el) targetRefs.current.set(field.path!, el); }}
                    >
                      <DroppableField
                        field={field}
                        color={fieldColors[field.path!] || '#666'}
                        connection={connectionByTarget[field.path!]}
                        onEdit={setEditingConnection}
                        onDelete={handleDeleteConnection}
                        onValidation={setShowValidationModal}
                      />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="w-96 bg-gray-50 dark:bg-gray-900 border-l dark:border-gray-700 p-4 overflow-y-auto flex-shrink-0">
            <MappingPreview
              connections={connections}
              sourceFields={sourceFields}
              headerFields={headerFields}
              onEdit={setEditingConnection}
              onDelete={handleDeleteConnection}
              testData={testData}
              testHeaders={testHeaders}
              onTestDataChange={setTestData}
              onTestHeadersChange={setTestHeaders}
            />
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {activeField && (
            <DragOverlayContent 
              field={activeField} 
              color={fieldColors[activeField.path!] || '#666'} 
            />
          )}
        </DragOverlay>

        {/* Formula Editor Modal */}
        {editingConnection && (
          <FormulaEditor
            connection={editingConnection}
            sourceFields={sourceFields}
            onSave={handleSaveFormula}
            onCancel={() => setEditingConnection(null)}
          />
        )}

        {/* Import Schema Modal */}
        {showImportModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden">
              <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-blue-50 dark:from-blue-900/30 to-white dark:to-gray-800">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                    <FileJson size={20} className="text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <h2 className="text-lg font-semibold dark:text-white">Import {showImportModal === 'source' ? 'Source' : 'Target'} Schema</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Paste JSON or upload a file to auto-detect fields</p>
                  </div>
                </div>
                <button 
                  onClick={() => { setShowImportModal(null); setImportJson(''); setImportError(''); }}
                  className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg dark:text-gray-300"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="p-6 space-y-4">
                {/* Schema Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Schema Name</label>
                  <input
                    type="text"
                    value={importSchemaName}
                    onChange={(e) => setImportSchemaName(e.target.value)}
                    placeholder={`My ${showImportModal === 'source' ? 'Source' : 'Target'} Schema`}
                    className="w-full px-4 py-2.5 border-2 dark:border-gray-600 rounded-lg focus:border-blue-400 focus:outline-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Leave empty for auto-generated name</p>
                </div>

                {/* File Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Upload JSON File</label>
                  <label className="flex items-center justify-center gap-2 px-4 py-8 border-2 border-dashed dark:border-gray-600 rounded-lg cursor-pointer hover:border-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors">
                    <FileUp size={24} className="text-gray-400" />
                    <span className="text-gray-600 dark:text-gray-300">Click to upload or drag & drop</span>
                    <input
                      type="file"
                      accept=".json,application/json"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex-1 border-t"></div>
                  <span className="text-sm text-gray-400">or paste JSON</span>
                  <div className="flex-1 border-t"></div>
                </div>

                {/* JSON Input */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">JSON Data</label>
                    <button
                      onClick={() => setImportJson(JSON.stringify({
                        user_id: "123",
                        user_email: "example@email.com",
                        first_name: "John",
                        last_name: "Doe",
                        age: 25,
                        is_active: true,
                        address: {
                          street: "123 Main St",
                          city: "New York"
                        },
                        tags: ["tag1", "tag2"]
                      }, null, 2))}
                      className="text-xs text-blue-600 hover:text-blue-700"
                    >
                      Load Example
                    </button>
                  </div>
                  <textarea
                    value={importJson}
                    onChange={(e) => { setImportJson(e.target.value); setImportError(''); }}
                    rows={12}
                    className={cn(
                      "w-full px-4 py-3 border-2 rounded-lg font-mono text-sm resize-none bg-white dark:bg-gray-700 text-gray-900 dark:text-white",
                      importError ? "border-red-300 bg-red-50" : "border-gray-200 dark:border-gray-600 focus:border-blue-400"
                    )}
                    placeholder='{\n  "field_name": "value",\n  "another_field": 123\n}'
                  />
                  {importError && (
                    <div className="flex items-center gap-2 mt-2 text-red-600">
                      <AlertCircle size={14} />
                      <p className="text-sm">{importError}</p>
                    </div>
                  )}
                </div>

                {/* Preview */}
                {importJson && !importError && (() => {
                  try {
                    const parsed = JSON.parse(importJson);
                    const fields = parseJsonToFields(parsed);
                    return (
                      <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <Eye size={16} className="text-gray-500 dark:text-gray-400" />
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">Preview: {fields.length} fields detected</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {fields.slice(0, 10).map((f) => (
                            <span
                              key={f.path}
                              className="px-2 py-1 rounded-full text-xs font-medium"
                              style={{ 
                                backgroundColor: `${getFieldColor(f.path!)}20`,
                                color: getFieldColor(f.path!)
                              }}
                            >
                              {f.name}: {f.type}
                            </span>
                          ))}
                          {fields.length > 10 && (
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-600">
                              +{fields.length - 10} more
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  } catch {
                    return null;
                  }
                })()}
              </div>

              <div className="px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-3">
                <button 
                  onClick={() => { setShowImportModal(null); setImportJson(''); setImportSchemaName(''); setImportError(''); }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleImportSchema}
                  disabled={!importJson}
                  className={cn(
                    "px-4 py-2 rounded-lg flex items-center gap-2",
                    importJson
                      ? "bg-blue-600 text-white hover:bg-blue-700"
                      : "bg-gray-300 text-gray-500 cursor-not-allowed"
                  )}
                >
                  <Plus size={16} />
                  Import Schema
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Validation Editor Modal */}
        {showValidationModal && (
          <ValidationEditor
            connection={showValidationModal}
            onSave={handleSaveValidation}
            onCancel={() => setShowValidationModal(null)}
          />
        )}

        {/* AI Suggest Modal */}
        {showAIModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowAIModal(false)}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-[800px] max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
              {/* Header */}
              <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-600 rounded-t-xl">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Wand2 size={24} className="text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">AI Mapping Suggestions</h2>
                    <p className="text-purple-200 text-sm">Configure AI provider and get intelligent field mapping suggestions</p>
                  </div>
                </div>
                <button onClick={() => setShowAIModal(false)} className="p-2 hover:bg-white/20 rounded-lg text-white">
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* AI Provider Configuration */}
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Settings size={18} className="text-gray-600 dark:text-gray-400" />
                    <h3 className="font-semibold text-gray-800 dark:text-white">AI Provider Configuration</h3>
                  </div>
                  
                  {/* Provider Selection */}
                  <div className="grid grid-cols-5 gap-2 mb-4">
                    {AI_PROVIDERS.map((p) => (
                      <button
                        key={p.id}
                        onClick={() => setAIConfig({ 
                          ...aiConfig, 
                          provider: p.id, 
                          model: p.models[0].id,
                          baseUrl: p.id === 'ollama' ? 'http://localhost:11434' : p.id === 'custom' ? '' : aiConfig.baseUrl
                        })}
                        className={cn(
                          "p-3 rounded-lg border-2 transition-all flex flex-col items-center gap-2",
                          aiConfig.provider === p.id
                            ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30"
                            : "border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-500"
                        )}
                      >
                        <span className="text-xl">{p.icon}</span>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-200">{p.name}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    {/* API Key */}
                    {aiConfig.provider !== 'ollama' && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <div className="flex items-center gap-1">
                            <Key size={14} />
                            API Key
                          </div>
                        </label>
                        <input
                          type="password"
                          value={aiConfig.apiKey}
                          onChange={(e) => setAIConfig({ ...aiConfig, apiKey: e.target.value })}
                          placeholder={`Enter ${AI_PROVIDERS.find(p => p.id === aiConfig.provider)?.name} API key...`}
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}

                    {/* Base URL (for Ollama and Custom) */}
                    {(aiConfig.provider === 'ollama' || aiConfig.provider === 'custom') && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          <div className="flex items-center gap-1">
                            <Globe size={14} />
                            Base URL
                          </div>
                        </label>
                        <input
                          type="text"
                          value={aiConfig.baseUrl}
                          onChange={(e) => setAIConfig({ ...aiConfig, baseUrl: e.target.value })}
                          placeholder={aiConfig.provider === 'ollama' ? 'http://localhost:11434' : 'https://api.example.com/v1'}
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        />
                      </div>
                    )}

                    {/* Model Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        <div className="flex items-center gap-1">
                          <Cpu size={14} />
                          Model
                        </div>
                      </label>
                      {aiConfig.provider === 'custom' ? (
                        <input
                          type="text"
                          value={aiConfig.model}
                          onChange={(e) => setAIConfig({ ...aiConfig, model: e.target.value })}
                          placeholder="model-name"
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        />
                      ) : (
                        <select
                          value={aiConfig.model}
                          onChange={(e) => setAIConfig({ ...aiConfig, model: e.target.value })}
                          className="w-full px-3 py-2 border dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-600 text-gray-900 dark:text-white"
                        >
                          {AI_PROVIDERS.find(p => p.id === aiConfig.provider)?.models.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      )}
                    </div>

                    {/* Temperature */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Temperature: {aiConfig.temperature.toFixed(1)}
                      </label>
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.1"
                        value={aiConfig.temperature}
                        onChange={(e) => setAIConfig({ ...aiConfig, temperature: parseFloat(e.target.value) })}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>Precise</span>
                        <span>Creative</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  onClick={generateAISuggestions}
                  disabled={isAILoading || (aiConfig.provider !== 'ollama' && !aiConfig.apiKey)}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-medium hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAILoading ? (
                    <>
                      <Loader2 className="animate-spin" size={20} />
                      Generating suggestions...
                    </>
                  ) : (
                    <>
                      <Sparkles size={20} />
                      Generate AI Suggestions
                    </>
                  )}
                </button>

                {/* Error Message */}
                {aiError && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle size={20} className="text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-red-800">Error generating suggestions</p>
                      <p className="text-sm text-red-600 mt-1">{aiError}</p>
                    </div>
                  </div>
                )}

                {/* AI Suggestions Results */}
                {aiSuggestions.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Bot size={18} className="text-purple-600 dark:text-purple-400" />
                        <h3 className="font-semibold text-gray-800 dark:text-white">Suggested Mappings ({aiSuggestions.length})</h3>
                      </div>
                      <button
                        onClick={applyAllSuggestions}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 flex items-center gap-2"
                      >
                        <Check size={16} />
                        Apply All
                      </button>
                    </div>

                    <div className="space-y-3 max-h-[300px] overflow-y-auto">
                      {aiSuggestions.map((suggestion, idx) => {
                        const alreadyMapped = !!connectionByTarget[suggestion.targetField];
                        return (
                          <div
                            key={idx}
                            className={cn(
                              "p-4 rounded-lg border-2 transition-all",
                              alreadyMapped ? "bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 opacity-60" : "bg-white dark:bg-gray-700 border-purple-200 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-500"
                            )}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                {/* Source Field */}
                                <div className="flex items-center gap-2 min-w-[150px]">
                                  <span
                                    className="px-3 py-1.5 rounded-full text-sm font-medium"
                                    style={{
                                      backgroundColor: `${fieldColors[suggestion.sourceField] || FIELD_COLORS[0]}20`,
                                      color: fieldColors[suggestion.sourceField] || FIELD_COLORS[0]
                                    }}
                                  >
                                    {suggestion.sourceField}
                                  </span>
                                </div>

                                {/* Arrow */}
                                <div className="flex items-center gap-2 text-gray-400">
                                  <ArrowRight size={16} />
                                  {suggestion.transformType !== 'direct' && (
                                    <span className="px-2 py-0.5 bg-orange-100 text-orange-700 rounded text-xs font-medium">
                                      {suggestion.transformType}
                                    </span>
                                  )}
                                </div>

                                {/* Target Field */}
                                <div className="flex items-center gap-2 min-w-[150px]">
                                  <span className="px-3 py-1.5 rounded-full text-sm font-medium bg-blue-100 text-blue-700">
                                    {suggestion.targetField}
                                  </span>
                                </div>

                                {/* Confidence Badge */}
                                <div className="ml-auto flex items-center gap-2">
                                  <span className={cn(
                                    "px-2 py-1 rounded-full text-xs font-medium",
                                    suggestion.confidence >= 0.8 ? "bg-green-100 text-green-700" :
                                    suggestion.confidence >= 0.5 ? "bg-yellow-100 text-yellow-700" :
                                    "bg-red-100 text-red-700"
                                  )}>
                                    {Math.round(suggestion.confidence * 100)}% confidence
                                  </span>
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex items-center gap-2 ml-4">
                                {alreadyMapped ? (
                                  <span className="text-xs text-gray-500 italic">Already mapped</span>
                                ) : (
                                  <>
                                    <button
                                      onClick={() => applyAISuggestion(suggestion)}
                                      className="p-2 bg-green-100 text-green-600 rounded-lg hover:bg-green-200"
                                      title="Apply this suggestion"
                                    >
                                      <Check size={16} />
                                    </button>
                                    <button
                                      onClick={() => setAISuggestions(aiSuggestions.filter((_, i) => i !== idx))}
                                      className="p-2 bg-red-100 text-red-600 rounded-lg hover:bg-red-200"
                                      title="Reject this suggestion"
                                    >
                                      <X size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>

                            {/* Reason */}
                            {suggestion.reason && (
                              <p className="mt-2 text-sm text-gray-600 italic pl-2 border-l-2 border-purple-200">
                                {suggestion.reason}
                              </p>
                            )}

                            {/* Formula Preview */}
                            {suggestion.formula && suggestion.formula !== `source.${suggestion.sourceField}` && (
                              <div className="mt-2 px-3 py-2 bg-gray-100 dark:bg-gray-600 rounded font-mono text-xs text-gray-700 dark:text-gray-200">
                                {suggestion.formula}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Empty State */}
                {!isAILoading && aiSuggestions.length === 0 && !aiError && (
                  <div className="text-center py-8 text-gray-500">
                    <Bot size={48} className="mx-auto mb-3 text-gray-300" />
                    <p>Configure your AI provider and click "Generate AI Suggestions"</p>
                    <p className="text-sm mt-1">AI will analyze source and target schemas to suggest field mappings</p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between rounded-b-xl">
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {aiConfig.provider === 'ollama' && (
                    <span className="flex items-center gap-1">
                      <Server size={14} />
                      Using local Ollama server
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setShowAIModal(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DndContext>
  );
}
