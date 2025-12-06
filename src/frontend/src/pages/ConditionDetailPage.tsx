import { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2,
  GitBranch,
  ChevronDown,
  ChevronRight,
  Loader2,
  Database,
  Hash,
  Type,
  ToggleLeft,
  Braces,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { cn, getNodeColor, generateId } from '@/lib/utils';
import { workflowsApi } from '@/api';
import type { Condition } from '@/types';

// Global fields always available
const GLOBAL_FIELDS = [
  { id: 'global_method', name: '$request.method', type: 'string', description: 'HTTP method (GET, POST, etc.)' },
  { id: 'global_path', name: '$request.path', type: 'string', description: 'Request path' },
  { id: 'global_ip', name: '$request.ip', type: 'string', description: 'Client IP address' },
  { id: 'global_timestamp', name: '$request.timestamp', type: 'number', description: 'Request timestamp (Unix)' },
  { id: 'global_content_type', name: '$request.contentType', type: 'string', description: 'Content-Type header' },
  { id: 'global_user_agent', name: '$request.userAgent', type: 'string', description: 'User-Agent header' },
];

// Operators for different field types
const OPERATORS = {
  string: [
    { value: 'eq', label: '=', description: 'equals' },
    { value: 'neq', label: '≠', description: 'not equals' },
    { value: 'contains', label: '∋', description: 'contains' },
    { value: 'notContains', label: '∌', description: 'not contains' },
    { value: 'startsWith', label: '^=', description: 'starts with' },
    { value: 'endsWith', label: '$=', description: 'ends with' },
    { value: 'regex', label: '/./', description: 'matches regex' },
    { value: 'empty', label: '∅', description: 'is empty' },
    { value: 'notEmpty', label: '≠∅', description: 'is not empty' },
  ],
  number: [
    { value: 'eq', label: '=', description: 'equals' },
    { value: 'neq', label: '≠', description: 'not equals' },
    { value: 'gt', label: '>', description: 'greater than' },
    { value: 'gte', label: '≥', description: 'greater or equal' },
    { value: 'lt', label: '<', description: 'less than' },
    { value: 'lte', label: '≤', description: 'less or equal' },
    { value: 'between', label: '↔', description: 'between' },
  ],
  boolean: [
    { value: 'eq', label: '=', description: 'equals' },
    { value: 'isTrue', label: '✓', description: 'is true' },
    { value: 'isFalse', label: '✗', description: 'is false' },
  ],
  object: [
    { value: 'exists', label: '∃', description: 'exists' },
    { value: 'notExists', label: '∄', description: 'not exists' },
    { value: 'empty', label: '∅', description: 'is empty' },
    { value: 'notEmpty', label: '≠∅', description: 'is not empty' },
  ],
  array: [
    { value: 'contains', label: '∋', description: 'contains' },
    { value: 'notContains', label: '∌', description: 'not contains' },
    { value: 'empty', label: '∅', description: 'is empty' },
    { value: 'notEmpty', label: '≠∅', description: 'is not empty' },
    { value: 'lengthEq', label: 'len=', description: 'length equals' },
    { value: 'lengthGt', label: 'len>', description: 'length greater than' },
  ],
};

interface AvailableField {
  id: string;
  name: string;
  path: string;
  type: string;
  sourceNodeId: string;
  sourceNodeLabel: string;
  isGlobal?: boolean;
}

export default function ConditionDetailPage() {
  const { id: workflowId, nodeId } = useParams<{ id: string; nodeId: string }>();
  const navigate = useNavigate();
  const { nodes, getUpstreamNodes, schemas } = useWorkflowStore();
  
  const [conditions, setConditions] = useState<Condition[]>([]);
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set(['global']));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const currentNode = nodes.find(n => n.id === nodeId);
  
  // Load available fields from upstream nodes
  useEffect(() => {
    if (!nodeId) return;
    
    const fields: AvailableField[] = [];
    
    // Add global fields
    GLOBAL_FIELDS.forEach(f => {
      fields.push({
        id: f.id,
        name: f.name,
        path: f.name,
        type: f.type,
        sourceNodeId: 'global',
        sourceNodeLabel: 'Global',
        isGlobal: true,
      });
    });
    
    // Get upstream nodes
    const upstreamNodes = getUpstreamNodes(nodeId);
    
    upstreamNodes.forEach(node => {
      const nodeLabel = node.label || node.type;
      
      // Trigger node
      if (node.type === 'trigger') {
        ['body', 'headers', 'query'].forEach(field => {
          fields.push({
            id: `${node.id}_${field}`,
            name: field,
            path: `$${node.id}.${field}`,
            type: 'object',
            sourceNodeId: node.id,
            sourceNodeLabel: nodeLabel,
          });
        });
      }
      
      // Transform node - get target schema fields
      if (node.type === 'transform') {
        if (node.data?.targetSchemaId) {
          const schema = schemas.find(s => s.id === node.data.targetSchemaId);
          schema?.fields?.forEach(field => {
            fields.push({
              id: `${node.id}_${field.name}`,
              name: field.name,
              path: `$${node.id}.${field.name}`,
              type: field.type,
              sourceNodeId: node.id,
              sourceNodeLabel: nodeLabel,
            });
          });
        }
        // Fallback to mapping rules
        node.data?.mappingRules?.forEach((rule: { targetField: string }) => {
          if (!fields.find(f => f.name === rule.targetField && f.sourceNodeId === node.id)) {
            fields.push({
              id: `${node.id}_${rule.targetField}`,
              name: rule.targetField,
              path: `$${node.id}.${rule.targetField}`,
              type: 'any',
              sourceNodeId: node.id,
              sourceNodeLabel: nodeLabel,
            });
          }
        });
      }
      
      // HTTP node
      if (node.type === 'http') {
        ['response', 'status', 'headers'].forEach(field => {
          fields.push({
            id: `${node.id}_${field}`,
            name: field,
            path: `$${node.id}.${field}`,
            type: field === 'status' ? 'number' : 'object',
            sourceNodeId: node.id,
            sourceNodeLabel: nodeLabel,
          });
        });
      }
      
      // Code node
      if (node.type === 'code') {
        fields.push({
          id: `${node.id}_result`,
          name: 'result',
          path: `$${node.id}.result`,
          type: 'any',
          sourceNodeId: node.id,
          sourceNodeLabel: nodeLabel,
        });
      }
    });
    
    setAvailableFields(fields);
    setLoading(false);
  }, [nodeId, getUpstreamNodes, schemas]);
  
  // Load existing conditions
  useEffect(() => {
    if (currentNode?.data?.conditions) {
      setConditions(currentNode.data.conditions);
    }
  }, [currentNode]);
  
  const handleSave = useCallback(async () => {
    if (!nodeId || !workflowId) return;
    
    setSaving(true);
    try {
      const workflow = await workflowsApi.get(workflowId);
      const updatedNodes = workflow.nodes.map(n => 
        n.id === nodeId 
          ? { ...n, data: { ...n.data, conditions } }
          : n
      );
      
      await workflowsApi.update(workflowId, { ...workflow, nodes: updatedNodes });
      navigate(`/workflows/${workflowId}`);
    } catch (error) {
      console.error('Failed to save:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [nodeId, workflowId, conditions, navigate]);
  
  const addCondition = () => {
    const newCondition: Condition = {
      id: generateId(),
      field: '',
      operator: 'eq',
      value: '',
      outputId: 'true',
    };
    setConditions([...conditions, newCondition]);
  };
  
  const updateCondition = (id: string, updates: Partial<Condition>) => {
    setConditions(conditions.map(c => c.id === id ? { ...c, ...updates } : c));
  };
  
  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };
  
  // Group fields by source
  const groupedFields = useMemo(() => {
    const groups: Map<string, AvailableField[]> = new Map();
    groups.set('global', []);
    
    availableFields.forEach(field => {
      const key = field.isGlobal ? 'global' : field.sourceNodeId;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(field);
    });
    
    return groups;
  }, [availableFields]);
  
  const getFieldType = (fieldPath: string): string => {
    const field = availableFields.find(f => f.path === fieldPath);
    return field?.type || 'string';
  };
  
  const getOperatorsForField = (fieldPath: string) => {
    const type = getFieldType(fieldPath);
    return OPERATORS[type as keyof typeof OPERATORS] || OPERATORS.string;
  };
  
  const getFieldIcon = (type: string) => {
    switch (type) {
      case 'string': return Type;
      case 'number': return Hash;
      case 'boolean': return ToggleLeft;
      case 'object': case 'array': return Braces;
      default: return Database;
    }
  };
  
  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Header */}
      <div className="bg-white border-b shadow-sm px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            onClick={() => navigate(`/workflows/${workflowId}`)}
          >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-amber-500" />
              Condition Configuration
            </h1>
            <p className="text-sm text-gray-500">
              Define conditions to branch your workflow
            </p>
          </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-50 transition-all shadow-md"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Save
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Available Fields */}
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-50 to-white">
              <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                <Database className="h-4 w-4 text-amber-500" />
                Available Fields
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">Click to use in condition</p>
            </div>
            <div className="max-h-[500px] overflow-y-auto">
              {Array.from(groupedFields.entries()).map(([sourceId, fields]) => {
                if (fields.length === 0) return null;
                
                const isExpanded = expandedSources.has(sourceId);
                const sourceLabel = sourceId === 'global' 
                  ? 'Global Variables' 
                  : fields[0]?.sourceNodeLabel || 'Unknown';
                const nodeColor = sourceId === 'global' 
                  ? '#6366F1' 
                  : getNodeColor(nodes.find(n => n.id === sourceId)?.type || '');
                
                return (
                  <div key={sourceId} className="border-b last:border-b-0">
                    <button
                      onClick={() => {
                        setExpandedSources(prev => {
                          const next = new Set(prev);
                          if (next.has(sourceId)) next.delete(sourceId);
                          else next.add(sourceId);
                          return next;
                        });
                      }}
                      className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50"
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: nodeColor }} />
                      <span className="text-sm font-medium flex-1 text-left">{sourceLabel}</span>
                      <span className="text-xs text-gray-400">{fields.length}</span>
                    </button>
                    
                    {isExpanded && (
                      <div className="bg-gray-50 border-t">
                        {fields.map(field => {
                          const FieldIcon = getFieldIcon(field.type);
                          return (
                            <div
                              key={field.id}
                              className="flex items-center gap-2 px-3 py-2 pl-8 hover:bg-gray-100 cursor-pointer text-sm"
                              onClick={() => {
                                // Add new condition with this field
                                const newCondition: Condition = {
                                  id: generateId(),
                                  field: field.path,
                                  operator: 'eq',
                                  value: '',
                                  outputId: 'true',
                                };
                                setConditions([...conditions, newCondition]);
                              }}
                            >
                              <FieldIcon size={12} className="text-gray-400" />
                              <code className="text-xs font-mono flex-1">{field.name}</code>
                              <span className="text-2xs text-gray-400">{field.type}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          
          {/* Right: Conditions */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b bg-gradient-to-r from-amber-50 to-white flex items-center justify-between">
                <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                  <GitBranch className="h-4 w-4 text-amber-500" />
                  Conditions
                  <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
                    {conditions.length}
                  </span>
                </h3>
                <button
                  onClick={addCondition}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-amber-500 text-white rounded-lg hover:bg-amber-600"
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>
              
              <div className="p-4 space-y-3">
                {conditions.length === 0 ? (
                  <div className="text-center py-8 text-gray-400">
                    <GitBranch size={40} className="mx-auto mb-2 opacity-50" />
                    <p>No conditions yet</p>
                    <p className="text-sm">Add conditions to branch your workflow</p>
                  </div>
                ) : (
                  conditions.map((condition, index) => {
                    const operators = getOperatorsForField(condition.field);
                    const needsValue = !['empty', 'notEmpty', 'exists', 'notExists', 'isTrue', 'isFalse'].includes(condition.operator);
                    
                    return (
                      <div key={condition.id} className="p-4 border rounded-lg bg-gray-50">
                        <div className="flex items-start gap-3">
                          <span className="w-6 h-6 flex items-center justify-center bg-amber-100 text-amber-700 rounded-full text-xs font-bold">
                            {index + 1}
                          </span>
                          
                          <div className="flex-1 space-y-3">
                            {/* Field selector */}
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500 w-16">Field</label>
                              <select
                                value={condition.field}
                                onChange={(e) => updateCondition(condition.id, { field: e.target.value })}
                                className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono bg-white"
                              >
                                <option value="">Select field...</option>
                                {Array.from(groupedFields.entries()).map(([sourceId, fields]) => (
                                  <optgroup key={sourceId} label={sourceId === 'global' ? '🌐 Global' : `📦 ${fields[0]?.sourceNodeLabel}`}>
                                    {fields.map(f => (
                                      <option key={f.id} value={f.path}>{f.name}</option>
                                    ))}
                                  </optgroup>
                                ))}
                              </select>
                            </div>
                            
                            {/* Operator selector */}
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500 w-16">Operator</label>
                              <select
                                value={condition.operator}
                                onChange={(e) => updateCondition(condition.id, { operator: e.target.value })}
                                className="w-32 px-3 py-2 border rounded-lg text-sm bg-white"
                              >
                                {operators.map(op => (
                                  <option key={op.value} value={op.value}>
                                    {op.label} {op.description}
                                  </option>
                                ))}
                              </select>
                              
                              {/* Value input */}
                              {needsValue && (
                                <input
                                  type="text"
                                  value={String(condition.value || '')}
                                  onChange={(e) => updateCondition(condition.id, { value: e.target.value })}
                                  placeholder="Value..."
                                  className="flex-1 px-3 py-2 border rounded-lg text-sm font-mono bg-white"
                                />
                              )}
                            </div>
                            
                            {/* Output selector */}
                            <div className="flex items-center gap-2">
                              <label className="text-xs text-gray-500 w-16">Then</label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => updateCondition(condition.id, { outputId: 'true' })}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                                    condition.outputId === 'true'
                                      ? "bg-green-500 text-white"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  )}
                                >
                                  ✓ Yes
                                </button>
                                <button
                                  onClick={() => updateCondition(condition.id, { outputId: 'false' })}
                                  className={cn(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-all",
                                    condition.outputId === 'false'
                                      ? "bg-red-500 text-white"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  )}
                                >
                                  ✗ No
                                </button>
                              </div>
                            </div>
                          </div>
                          
                          <button
                            onClick={() => removeCondition(condition.id)}
                            className="p-1.5 hover:bg-red-100 rounded text-red-400 hover:text-red-600"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
            
            {/* Logic explanation */}
            {conditions.length > 0 && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <h4 className="font-medium text-amber-800 mb-2">How it works:</h4>
                <ul className="text-sm text-amber-700 space-y-1">
                  <li>• Conditions are evaluated in order (top to bottom)</li>
                  <li>• First matching condition determines the output path</li>
                  <li>• If no condition matches, flow goes to "No" output</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
