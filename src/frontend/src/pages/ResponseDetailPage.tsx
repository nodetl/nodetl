import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Save, 
  Plus, 
  Trash2, 
  Settings,
  Database,
  ArrowRight,
  Check,
  Loader2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { cn, getNodeColor } from '@/lib/utils';
import { workflowsApi } from '@/api';
import type { ResponseConfig } from '@/types';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8080/api/v1';

interface AvailableField {
  path: string;
  type: string;
  source: 'transform' | 'http';
  sourceNodeId: string;
  sourceNodeLabel: string;
}

interface NodeSchemaResponse {
  targetSchema?: {
    fields: Array<{ name: string; type: string }>;
  };
}

const HTTP_STATUS_CODES = [
  { code: 200, label: '200 OK' },
  { code: 201, label: '201 Created' },
  { code: 204, label: '204 No Content' },
  { code: 400, label: '400 Bad Request' },
  { code: 401, label: '401 Unauthorized' },
  { code: 403, label: '403 Forbidden' },
  { code: 404, label: '404 Not Found' },
  { code: 500, label: '500 Internal Server Error' },
];

export default function ResponseDetailPage() {
  const { id: workflowId, nodeId } = useParams<{ id: string; nodeId: string }>();
  const navigate = useNavigate();
  const { nodes, edges, getUpstreamNodes } = useWorkflowStore();
  
  const [config, setConfig] = useState<ResponseConfig>({
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    selectedFields: [],
  });
  
  const [availableFields, setAvailableFields] = useState<AvailableField[]>([]);
  const [expandedSources, setExpandedSources] = useState<Set<string>>(new Set());
  const [newHeader, setNewHeader] = useState({ key: '', value: '' });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Get current node
  const currentNode = nodes.find(n => n.id === nodeId);
  
  // Fetch node schema from API
  const fetchNodeSchema = async (wfId: string, nId: string): Promise<NodeSchemaResponse | null> => {
    try {
      const response = await fetch(`${API_BASE}/workflows/${wfId}/nodes/${nId}/schema`);
      if (!response.ok) return null;
      return await response.json();
    } catch {
      return null;
    }
  };
  
  // Get available fields from connected nodes (from database)
  useEffect(() => {
    if (!nodeId || !workflowId) return;
    
    const loadFields = async () => {
      setLoading(true);
      const fields: AvailableField[] = [];
      
      // Get ALL upstream nodes (not just immediate connections)
      const upstreamNodes = getUpstreamNodes(nodeId);
      
      if (upstreamNodes.length === 0) {
        // Fallback to immediate connections
        const incomingEdges = edges.filter(e => e.target === nodeId);
        for (const edge of incomingEdges) {
          const sourceNode = nodes.find(n => n.id === edge.source);
          if (sourceNode) {
            upstreamNodes.push(sourceNode);
          }
        }
      }
      
      if (upstreamNodes.length === 0) {
        setLoading(false);
        return;
      }
      
      // Initialize expanded sources
      const initialExpanded = new Set<string>();
      
      // Get all source nodes connected to this response node
      for (const sourceNode of upstreamNodes) {
        const nodeLabel = sourceNode.label || sourceNode.type || 'Unknown';
        initialExpanded.add(sourceNode.id);
        
        // If source is Trigger node - get input fields
        if (sourceNode.type === 'trigger') {
          fields.push({
            path: 'body',
            type: 'object',
            source: 'transform',
            sourceNodeId: sourceNode.id,
            sourceNodeLabel: nodeLabel,
          });
          fields.push({
            path: 'headers',
            type: 'object',
            source: 'transform',
            sourceNodeId: sourceNode.id,
            sourceNodeLabel: nodeLabel,
          });
          fields.push({
            path: 'query',
            type: 'object',
            source: 'transform',
            sourceNodeId: sourceNode.id,
            sourceNodeLabel: nodeLabel,
          });
        }
        
        // If source is Transform node - get target fields from database
        if (sourceNode.type === 'transform') {
          const schema = await fetchNodeSchema(workflowId, sourceNode.id);
          if (schema?.targetSchema?.fields) {
            schema.targetSchema.fields.forEach(field => {
              fields.push({
                path: field.name,
                type: field.type || 'string',
                source: 'transform',
                sourceNodeId: sourceNode.id,
                sourceNodeLabel: nodeLabel,
              });
            });
          } else if (sourceNode.data?.mappingRules) {
            // Fallback to mappingRules if no schema in DB
            (sourceNode.data.mappingRules as Array<{ targetField: string }>).forEach((rule) => {
              fields.push({
                path: rule.targetField,
                type: 'string',
                source: 'transform',
                sourceNodeId: sourceNode.id,
                sourceNodeLabel: nodeLabel,
              });
            });
          }
        }
        
        // If source is HTTP Request node - get response fields
        if (sourceNode.type === 'http') {
          const httpFields = ['data', 'status', 'statusText', 'headers'];
          httpFields.forEach(field => {
            fields.push({
              path: field,
              type: field === 'status' ? 'number' : 'object',
              source: 'http',
              sourceNodeId: sourceNode.id,
              sourceNodeLabel: nodeLabel,
            });
          });
        }
        
        // If source is Code node - get result
        if (sourceNode.type === 'code') {
          fields.push({
            path: 'result',
            type: 'any',
            source: 'transform',
            sourceNodeId: sourceNode.id,
            sourceNodeLabel: nodeLabel,
          });
        }
        
        // If source is Condition node - get matched status
        if (sourceNode.type === 'condition') {
          fields.push({
            path: 'matched',
            type: 'boolean',
            source: 'transform',
            sourceNodeId: sourceNode.id,
            sourceNodeLabel: nodeLabel,
          });
          fields.push({
            path: 'data',
            type: 'object',
            source: 'transform',
            sourceNodeId: sourceNode.id,
            sourceNodeLabel: nodeLabel,
          });
        }
        
        // If source is Loop node
        if (sourceNode.type === 'loop') {
          fields.push({
            path: 'items',
            type: 'array',
            source: 'transform',
            sourceNodeId: sourceNode.id,
            sourceNodeLabel: nodeLabel,
          });
          fields.push({
            path: 'item',
            type: 'any',
            source: 'transform',
            sourceNodeId: sourceNode.id,
            sourceNodeLabel: nodeLabel,
          });
        }
      }
      
      setAvailableFields(fields);
      setExpandedSources(initialExpanded);
      setLoading(false);
    };
    
    loadFields();
  }, [nodeId, workflowId, nodes, edges, getUpstreamNodes]);
  
  // Load existing config
  useEffect(() => {
    if (currentNode?.data?.responseConfig) {
      const loadedConfig = currentNode.data.responseConfig;
      setConfig({
        ...loadedConfig,
        headers: loadedConfig.headers || { 'Content-Type': 'application/json' },
        selectedFields: loadedConfig.selectedFields || [],
      });
    }
  }, [currentNode]);
  
  const handleSave = useCallback(async () => {
    if (!nodeId || !workflowId) return;
    
    setSaving(true);
    try {
      // Fetch current workflow from API first to ensure we have latest data
      const currentWorkflow = await workflowsApi.get(workflowId);
      
      // Update the response node with new config
      const updatedNodes = currentWorkflow.nodes.map(n => 
        n.id === nodeId 
          ? { 
              ...n, 
              data: {
                ...n.data,
                responseConfig: config,
              }
            }
          : n
      );
      
      // Call API to save to database
      await workflowsApi.update(workflowId, {
        ...currentWorkflow,
        nodes: updatedNodes,
      });
      
      navigate(`/workflows/${workflowId}`);
    } catch (error) {
      console.error('Failed to save response config:', error);
      alert('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }, [nodeId, workflowId, config, currentNode, navigate]);
  
  const isFieldSelected = (path: string, source: 'transform' | 'http') => {
    return config.selectedFields.some(f => f.fieldPath === path && f.source === source);
  };
  
  const toggleField = (field: AvailableField) => {
    setConfig(prev => {
      const exists = prev.selectedFields.find(f => f.fieldPath === field.path && f.source === field.source);
      if (exists) {
        return {
          ...prev,
          selectedFields: prev.selectedFields.filter(f => !(f.fieldPath === field.path && f.source === field.source)),
        };
      } else {
        return {
          ...prev,
          selectedFields: [
            ...prev.selectedFields,
            { 
              id: `field-${Date.now()}`, 
              fieldPath: field.path, 
              source: field.source,
              sourceNodeId: field.sourceNodeId,
            },
          ],
        };
      }
    });
  };
  
  const updateFieldAlias = (id: string, alias: string) => {
    setConfig(prev => ({
      ...prev,
      selectedFields: prev.selectedFields.map(f => 
        f.id === id ? { ...f, alias } : f
      ),
    }));
  };
  
  const removeField = (id: string) => {
    setConfig(prev => ({
      ...prev,
      selectedFields: prev.selectedFields.filter(f => f.id !== id),
    }));
  };
  
  const addHeader = () => {
    if (!newHeader.key) return;
    setConfig(prev => ({
      ...prev,
      headers: { ...prev.headers, [newHeader.key]: newHeader.value },
    }));
    setNewHeader({ key: '', value: '' });
  };
  
  const removeHeader = (key: string) => {
    setConfig(prev => {
      const newHeaders = { ...prev.headers };
      delete newHeaders[key];
      return { ...prev, headers: newHeaders };
    });
  };
  
  // Build preview
  const buildPreviewBody = () => {
    // If using template, show the template with syntax highlighting hints
    if (config.useTemplate && config.responseTemplate) {
      try {
        // For preview, we show a simplified version
        // Remove #each, #if, #unless blocks for parsing, just show structure
        let preview = config.responseTemplate;
        
        // Replace loop blocks with sample array
        preview = preview.replace(/\{\{#each\s+\w+\}\}([\s\S]*?)\{\{\/each\}\}/g, '[$1]');
        
        // Replace if/unless blocks - just keep the content
        preview = preview.replace(/\{\{#if\s+[^}]+\}\}([\s\S]*?)(?:\{\{else\}\}[\s\S]*?)?\{\{\/if\}\}/g, '$1');
        preview = preview.replace(/\{\{#unless\s+[^}]+\}\}([\s\S]*?)\{\{\/unless\}\}/g, '$1');
        
        // Replace loop helpers
        preview = preview.replace(/\{\{@index\}\}/g, '0');
        preview = preview.replace(/\{\{@first\}\}/g, 'true');
        preview = preview.replace(/\{\{@last\}\}/g, 'false');
        
        // Replace field placeholders with sample values
        availableFields.forEach(field => {
          const placeholder = new RegExp(`"?\\{\\{${field.path}\\}\\}"?`, 'g');
          preview = preview.replace(placeholder, `"<${field.source}:${field.path}>"`);
        });
        
        // Replace any remaining placeholders
        preview = preview.replace(/"?\{\{([^#/][^}]*)\}\}"?/g, '"<$1>"');
        
        return JSON.parse(preview);
      } catch {
        return { _templatePreview: "Template will be processed at runtime", _syntax: "Valid JSON with template syntax required" };
      }
    }
    
    const body: Record<string, unknown> = {};
    config.selectedFields.forEach(field => {
      const key = field.alias || field.fieldPath;
      body[key] = `<${field.source}:${field.fieldPath}>`;
    });
    
    return body;
  };
  const previewBody = buildPreviewBody();
  
  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 shadow-sm px-4 sm:px-6 lg:px-8 3xl:px-12 py-3 sm:py-4 lg:py-5 flex items-center justify-between">
        <div className="flex items-center gap-3 sm:gap-4 lg:gap-6">
          <button 
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            onClick={() => navigate(`/workflows/${workflowId}`)}
          >
            <ArrowLeft className="h-5 w-5 sm:h-6 sm:w-6 text-gray-600 dark:text-gray-400" />
          </button>
          <div>
            <h1 className="text-lg sm:text-xl lg:text-2xl 3xl:text-3xl 5xl:text-4xl font-bold text-gray-900 dark:text-white">Response Configuration</h1>
            <p className="text-xs sm:text-sm lg:text-base 3xl:text-lg text-gray-500 dark:text-gray-400">
              Select fields to include in the API response
            </p>
          </div>
        </div>
        <button 
          onClick={handleSave} 
          disabled={saving}
          className="flex items-center gap-2 px-4 sm:px-5 lg:px-6 py-2 sm:py-2.5 lg:py-3 bg-indigo-600 text-white text-sm sm:text-base rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md hover:shadow-lg"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 sm:h-5 sm:w-5 animate-spin" />
              <span className="hidden sm:inline">Saving...</span>
            </>
          ) : (
            <>
              <Save className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="hidden sm:inline">Save Changes</span>
            </>
          )}
        </button>
      </div>
      
      {/* Content */}
      <div className="flex-1 overflow-auto p-4 sm:p-6 lg:p-8 3xl:p-12 5xl:p-16">
        <div className="max-w-5xl 3xl:max-w-6xl 4xl:max-w-7xl 5xl:max-w-[90rem] mx-auto grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 lg:gap-8 3xl:gap-12">
          {/* Left: Field Selection */}
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Available Fields */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 border-b dark:border-gray-700 bg-gradient-to-r from-indigo-50 dark:from-indigo-900/20 to-white dark:to-gray-800">
                <h3 className="text-sm sm:text-base lg:text-lg 3xl:text-xl font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Database className="h-4 w-4 sm:h-5 sm:w-5 text-indigo-600 dark:text-indigo-400" />
                  Available Fields
                </h3>
                <p className="text-xs sm:text-sm lg:text-base text-gray-500 dark:text-gray-400 mt-0.5">Click to select fields for response</p>
              </div>
              <div className="p-4 sm:p-5 lg:p-6 max-h-[300px] sm:max-h-[400px] lg:max-h-[500px] 3xl:max-h-[600px] 5xl:max-h-[800px] overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-8 sm:py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
                    <span className="mt-3 text-sm text-gray-500 dark:text-gray-400">Loading fields from schema...</span>
                  </div>
                ) : availableFields.length > 0 ? (
                  <div className="space-y-2">
                    {/* Group fields by source node */}
                    {(() => {
                      // Get unique source nodes
                      const sourceNodes = Array.from(
                        new Map(availableFields.map(f => [f.sourceNodeId, f])).values()
                      ).map(f => ({
                        id: f.sourceNodeId,
                        label: f.sourceNodeLabel,
                        source: f.source,
                      }));
                      
                      return sourceNodes.map(sourceNode => {
                        const nodeFields = availableFields.filter(f => f.sourceNodeId === sourceNode.id);
                        const isExpanded = expandedSources.has(sourceNode.id);
                        const nodeColor = getNodeColor(sourceNode.source === 'http' ? 'http' : 'transform');
                        const selectedCount = nodeFields.filter(f => isFieldSelected(f.path, f.source)).length;
                        
                        return (
                          <div key={sourceNode.id} className="border dark:border-gray-700 rounded-lg overflow-hidden">
                            {/* Node header - collapsible */}
                            <button
                              onClick={() => {
                                setExpandedSources(prev => {
                                  const next = new Set(prev);
                                  if (next.has(sourceNode.id)) {
                                    next.delete(sourceNode.id);
                                  } else {
                                    next.add(sourceNode.id);
                                  }
                                  return next;
                                });
                              }}
                              className={cn(
                                "w-full flex items-center gap-2 px-3 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors",
                                selectedCount > 0 && "bg-blue-50 dark:bg-blue-900/30"
                              )}
                            >
                              {isExpanded ? (
                                <ChevronDown size={16} className="text-gray-400 flex-shrink-0" />
                              ) : (
                                <ChevronRight size={16} className="text-gray-400 flex-shrink-0" />
                              )}
                              <div 
                                className="w-3 h-3 rounded-full flex-shrink-0"
                                style={{ backgroundColor: nodeColor }}
                              />
                              <span className="font-medium text-sm flex-1 text-left truncate dark:text-white">
                                {sourceNode.label}
                              </span>
                              <span className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                                {sourceNode.source === 'http' ? 'HTTP' : 'Data'}
                              </span>
                              {selectedCount > 0 && (
                                <span className="text-xs px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full">
                                  {selectedCount} selected
                                </span>
                              )}
                              <span className="text-xs px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded">
                                {nodeFields.length}
                              </span>
                            </button>
                            
                            {/* Fields list */}
                            {isExpanded && (
                              <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                                {nodeFields.map(field => (
                                  <button
                                    key={`${field.sourceNodeId}-${field.path}`}
                                    onClick={() => toggleField(field)}
                                    className={cn(
                                      "w-full px-3 py-2 pl-9 text-left text-sm flex items-center justify-between hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors",
                                      isFieldSelected(field.path, field.source)
                                        ? "bg-blue-100 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                                        : ""
                                    )}
                                  >
                                    <div className="flex items-center gap-2">
                                      <code className="font-mono text-xs dark:text-gray-200">{field.path}</code>
                                      <span className="text-2xs px-1.5 py-0.5 bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded">
                                        {field.type}
                                      </span>
                                    </div>
                                    <div className={cn(
                                      "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                                      isFieldSelected(field.path, field.source)
                                        ? "bg-blue-600 border-blue-600"
                                        : "border-gray-300"
                                    )}>
                                      {isFieldSelected(field.path, field.source) && (
                                        <Check className="h-2.5 w-2.5 text-white" />
                                      )}
                                    </div>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      });
                    })()}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12">
                    <div className="w-12 h-12 sm:w-16 sm:h-16 mx-auto mb-3 sm:mb-4 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <Database className="h-6 w-6 sm:h-8 sm:w-8 text-gray-400" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">No connected node found</p>
                    <p className="text-2xs sm:text-xs text-gray-400 dark:text-gray-500 mt-1">Connect a Transform or HTTP Request node first</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Status Code & Headers */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 border-b dark:border-gray-700 bg-gradient-to-r from-gray-50 dark:from-gray-700/50 to-white dark:to-gray-800">
                <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Settings className="h-4 w-4 sm:h-5 sm:w-5 text-gray-600 dark:text-gray-400" />
                  Response Settings
                </h3>
              </div>
              <div className="p-4 sm:p-5 lg:p-6 space-y-4 sm:space-y-5">
                <div>
                  <label className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 mb-1.5 sm:mb-2 block">Status Code</label>
                  <select
                    value={String(config.statusCode)}
                    onChange={(e) => setConfig(prev => ({ ...prev, statusCode: parseInt(e.target.value) }))}
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-xs sm:text-sm font-medium"
                  >
                    {HTTP_STATUS_CODES.map(({ code, label }) => (
                      <option key={code} value={String(code)} className="dark:bg-gray-700">{label}</option>
                    ))}
                  </select>
                </div>
                
                {/* Template Mode Toggle */}
                <div className="pt-2 border-t border-gray-100 dark:border-gray-700">
                  <label className="flex items-center justify-between cursor-pointer">
                    <div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Use Custom Template</span>
                      <p className="text-2xs sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5">Define a custom JSON structure with loops & conditionals</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.useTemplate || false}
                        onChange={(e) => setConfig(prev => ({ ...prev, useTemplate: e.target.checked }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 dark:peer-focus:ring-indigo-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                    </div>
                  </label>
                </div>
                
                {/* Response Template */}
                {config.useTemplate && (
                  <div className="space-y-3">
                    <label className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300 block">
                      Response Template
                      <span className="font-normal text-gray-400 dark:text-gray-500 ml-1">(JSON with placeholders)</span>
                    </label>
                    <textarea
                      value={config.responseTemplate || '{\n  "success": true,\n  "data": {\n    "id": "{{id}}",\n    "items": [\n      {{#each items}}\n      {\n        "name": "{{name}}",\n        "price": {{price}}\n      }{{#unless @last}},{{/unless}}\n      {{/each}}\n    ]\n  }\n}'}
                      onChange={(e) => setConfig(prev => ({ ...prev, responseTemplate: e.target.value }))}
                      placeholder='{\n  "data": {\n    "id": "{{id}}"\n  }\n}'
                      rows={14}
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 border-2 border-gray-200 rounded-lg sm:rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-xs sm:text-sm font-mono bg-slate-900 text-green-400"
                    />
                    
                    {/* Template Syntax Help */}
                    <div className="bg-gradient-to-r from-indigo-50 dark:from-indigo-900/30 to-purple-50 dark:to-purple-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg p-4 space-y-3">
                      <p className="text-xs font-semibold text-indigo-800 dark:text-indigo-300">Template Syntax:</p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded p-2">
                          <code className="text-indigo-600 dark:text-indigo-400 font-mono">{`{{fieldName}}`}</code>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">Insert field value</span>
                        </div>
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded p-2">
                          <code className="text-indigo-600 dark:text-indigo-400 font-mono">{`{{#each items}}...{{/each}}`}</code>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">Loop over array</span>
                        </div>
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded p-2">
                          <code className="text-indigo-600 dark:text-indigo-400 font-mono">{`{{#if condition}}...{{/if}}`}</code>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">Conditional block</span>
                        </div>
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded p-2">
                          <code className="text-indigo-600 dark:text-indigo-400 font-mono">{`{{#unless condition}}...{{/unless}}`}</code>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">Inverse conditional</span>
                        </div>
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded p-2">
                          <code className="text-indigo-600 dark:text-indigo-400 font-mono">{`{{@index}}, {{@first}}, {{@last}}`}</code>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">Loop helpers</span>
                        </div>
                        <div className="bg-white/70 dark:bg-gray-800/70 rounded p-2">
                          <code className="text-indigo-600 dark:text-indigo-400 font-mono">{`{{#if status == "active"}}...{{/if}}`}</code>
                          <span className="text-gray-600 dark:text-gray-400 ml-2">Comparison</span>
                        </div>
                      </div>
                      <p className="text-2xs text-gray-500 dark:text-gray-400 mt-2">
                        Available fields: <span className="font-mono text-indigo-600 dark:text-indigo-400">{availableFields.map(f => f.path).join(', ') || 'Connect a Transform node first'}</span>
                      </p>
                    </div>
                  </div>
                )}
                
                {/* Error Configuration */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">Error Handling</span>
                      <p className="text-2xs sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5">Configure error responses with TraceID</p>
                    </div>
                    <div className="relative">
                      <input
                        type="checkbox"
                        checked={config.errorConfig?.includeTraceId ?? true}
                        onChange={(e) => setConfig(prev => ({ 
                          ...prev, 
                          errorConfig: { 
                            ...prev.errorConfig,
                            includeTraceId: e.target.checked,
                            useCustomTemplate: prev.errorConfig?.useCustomTemplate ?? false
                          } 
                        }))}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 dark:peer-focus:ring-orange-800 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    {/* Use Custom Error Template Toggle */}
                    <label className="flex items-center justify-between cursor-pointer p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <span className="text-xs sm:text-sm text-gray-600 dark:text-gray-300">Use Custom Error Template</span>
                      <input
                        type="checkbox"
                        checked={config.errorConfig?.useCustomTemplate ?? false}
                        onChange={(e) => setConfig(prev => ({ 
                          ...prev, 
                          errorConfig: { 
                            ...prev.errorConfig,
                            includeTraceId: prev.errorConfig?.includeTraceId ?? true,
                            useCustomTemplate: e.target.checked 
                          } 
                        }))}
                        className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                      />
                    </label>
                    
                    {/* Custom Error Template */}
                    {config.errorConfig?.useCustomTemplate && (
                      <div>
                        <label className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5 block">Error Template</label>
                        <textarea
                          value={config.errorConfig?.errorTemplate || '{\n  "success": false,\n  "error": {\n    "code": {{statusCode}},\n    "type": "{{error}}",\n    "message": "{{message}}",\n    "traceId": "{{traceId}}",\n    "timestamp": "{{timestamp}}"\n  }\n}'}
                          onChange={(e) => setConfig(prev => ({ 
                            ...prev, 
                            errorConfig: { 
                              ...prev.errorConfig!,
                              errorTemplate: e.target.value 
                            } 
                          }))}
                          rows={8}
                          className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-xs font-mono bg-slate-900 text-orange-400"
                        />
                        <p className="text-2xs text-gray-400 dark:text-gray-500 mt-1.5">
                          Available: <code className="text-orange-500 dark:text-orange-400">{'{{error}}'}</code>, <code className="text-orange-500 dark:text-orange-400">{'{{message}}'}</code>, <code className="text-orange-500 dark:text-orange-400">{'{{traceId}}'}</code>, <code className="text-orange-500 dark:text-orange-400">{'{{statusCode}}'}</code>, <code className="text-orange-500 dark:text-orange-400">{'{{timestamp}}'}</code>
                        </p>
                      </div>
                    )}
                    
                    {/* Error Type Configurations */}
                    <div className="grid grid-cols-2 gap-2">
                      {/* 400 Bad Request */}
                      <div className="p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-red-700 dark:text-red-400">400 Validation</span>
                          <input
                            type="checkbox"
                            checked={config.errorConfig?.validationErrors?.enabled ?? false}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              errorConfig: { 
                                ...prev.errorConfig!,
                                includeTraceId: prev.errorConfig?.includeTraceId ?? true,
                                useCustomTemplate: prev.errorConfig?.useCustomTemplate ?? false,
                                validationErrors: { 
                                  enabled: e.target.checked,
                                  statusCode: prev.errorConfig?.validationErrors?.statusCode || 400 
                                }
                              } 
                            }))}
                            className="w-3.5 h-3.5 text-red-500 border-red-300 rounded focus:ring-red-500"
                          />
                        </div>
                        {config.errorConfig?.validationErrors?.enabled && (
                          <input
                            type="text"
                            placeholder="Custom template..."
                            value={config.errorConfig?.validationErrors?.template || ''}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              errorConfig: { 
                                ...prev.errorConfig!,
                                validationErrors: { 
                                  ...prev.errorConfig!.validationErrors!,
                                  template: e.target.value 
                                }
                              } 
                            }))}
                            className="w-full px-2 py-1 text-2xs border border-red-200 rounded focus:ring-1 focus:ring-red-400"
                          />
                        )}
                      </div>
                      
                      {/* 404 Not Found */}
                      <div className="p-2 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">404 Not Found</span>
                          <input
                            type="checkbox"
                            checked={config.errorConfig?.notFoundErrors?.enabled ?? false}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              errorConfig: { 
                                ...prev.errorConfig!,
                                includeTraceId: prev.errorConfig?.includeTraceId ?? true,
                                useCustomTemplate: prev.errorConfig?.useCustomTemplate ?? false,
                                notFoundErrors: { 
                                  enabled: e.target.checked,
                                  statusCode: prev.errorConfig?.notFoundErrors?.statusCode || 404 
                                }
                              } 
                            }))}
                            className="w-3.5 h-3.5 text-yellow-500 border-yellow-300 rounded focus:ring-yellow-500"
                          />
                        </div>
                        {config.errorConfig?.notFoundErrors?.enabled && (
                          <input
                            type="text"
                            placeholder="Custom template..."
                            value={config.errorConfig?.notFoundErrors?.template || ''}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              errorConfig: { 
                                ...prev.errorConfig!,
                                notFoundErrors: { 
                                  ...prev.errorConfig!.notFoundErrors!,
                                  template: e.target.value 
                                }
                              } 
                            }))}
                            className="w-full px-2 py-1 text-2xs border border-yellow-200 rounded focus:ring-1 focus:ring-yellow-400"
                          />
                        )}
                      </div>
                      
                      {/* 401 Unauthorized */}
                      <div className="p-2 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">401 Unauthorized</span>
                          <input
                            type="checkbox"
                            checked={config.errorConfig?.unauthorizedErrors?.enabled ?? false}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              errorConfig: { 
                                ...prev.errorConfig!,
                                includeTraceId: prev.errorConfig?.includeTraceId ?? true,
                                useCustomTemplate: prev.errorConfig?.useCustomTemplate ?? false,
                                unauthorizedErrors: { 
                                  enabled: e.target.checked,
                                  statusCode: prev.errorConfig?.unauthorizedErrors?.statusCode || 401 
                                }
                              } 
                            }))}
                            className="w-3.5 h-3.5 text-purple-500 border-purple-300 rounded focus:ring-purple-500"
                          />
                        </div>
                        {config.errorConfig?.unauthorizedErrors?.enabled && (
                          <input
                            type="text"
                            placeholder="Custom template..."
                            value={config.errorConfig?.unauthorizedErrors?.template || ''}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              errorConfig: { 
                                ...prev.errorConfig!,
                                unauthorizedErrors: { 
                                  ...prev.errorConfig!.unauthorizedErrors!,
                                  template: e.target.value 
                                }
                              } 
                            }))}
                            className="w-full px-2 py-1 text-2xs border border-purple-200 rounded focus:ring-1 focus:ring-purple-400"
                          />
                        )}
                      </div>
                      
                      {/* 403 Forbidden */}
                      <div className="p-2 bg-gray-100 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg">
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-gray-700 dark:text-gray-300">403 Forbidden</span>
                          <input
                            type="checkbox"
                            checked={config.errorConfig?.forbiddenErrors?.enabled ?? false}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              errorConfig: { 
                                ...prev.errorConfig!,
                                includeTraceId: prev.errorConfig?.includeTraceId ?? true,
                                useCustomTemplate: prev.errorConfig?.useCustomTemplate ?? false,
                                forbiddenErrors: { 
                                  enabled: e.target.checked,
                                  statusCode: prev.errorConfig?.forbiddenErrors?.statusCode || 403 
                                }
                              } 
                            }))}
                            className="w-3.5 h-3.5 text-gray-500 border-gray-300 rounded focus:ring-gray-500"
                          />
                        </div>
                        {config.errorConfig?.forbiddenErrors?.enabled && (
                          <input
                            type="text"
                            placeholder="Custom template..."
                            value={config.errorConfig?.forbiddenErrors?.template || ''}
                            onChange={(e) => setConfig(prev => ({ 
                              ...prev, 
                              errorConfig: { 
                                ...prev.errorConfig!,
                                forbiddenErrors: { 
                                  ...prev.errorConfig!.forbiddenErrors!,
                                  template: e.target.value 
                                }
                              } 
                            }))}
                            className="w-full px-2 py-1 text-2xs border border-gray-200 rounded focus:ring-1 focus:ring-gray-400"
                          />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Headers */}
                <div>
                  <label className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 block">Headers</label>
                  <div className="space-y-2">
                    {Object.entries(config.headers || {}).map(([key, value]) => (
                      <div key={key} className="flex items-center gap-1.5 sm:gap-2 p-1.5 sm:p-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-xs sm:text-sm">
                        <code className="font-mono font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-900/30 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-xs sm:text-sm">{key}</code>
                        <span className="text-gray-400">:</span>
                        <code className="flex-1 font-mono text-gray-600 dark:text-gray-300 text-xs sm:text-sm truncate">{value}</code>
                        <button onClick={() => removeHeader(key)} className="p-1 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors">
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mt-2 sm:mt-3">
                      <input 
                        type="text"
                        placeholder="Header name"
                        value={newHeader.key}
                        onChange={(e) => setNewHeader(prev => ({ ...prev, key: e.target.value }))}
                        className="flex-1 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                      />
                      <input 
                        type="text"
                        placeholder="Value"
                        value={newHeader.value}
                        onChange={(e) => setNewHeader(prev => ({ ...prev, value: e.target.value }))}
                        className="flex-1 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400"
                      />
                      <button onClick={addHeader} className="p-1.5 sm:p-2 bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-200 dark:hover:bg-indigo-900/70 transition-colors self-end sm:self-auto">
                        <Plus className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Right: Selected Fields & Preview */}
          <div className="space-y-4 sm:space-y-6 lg:space-y-8">
            {/* Selected Fields */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 border-b dark:border-gray-700 bg-gradient-to-r from-emerald-50 dark:from-emerald-900/30 to-white dark:to-gray-800">
                <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-gray-800 dark:text-white flex items-center gap-2">
                  <Check className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-600 dark:text-emerald-400" />
                  Selected Fields
                  <span className="ml-auto px-2 sm:px-2.5 py-0.5 bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 rounded-full text-xs sm:text-sm font-bold">
                    {config.selectedFields.length}
                  </span>
                </h3>
              </div>
              <div className="p-4 sm:p-5 lg:p-6 max-h-[300px] sm:max-h-[400px] overflow-y-auto">
                {config.selectedFields.length > 0 ? (
                  <div className="space-y-1.5 sm:space-y-2">
                    {config.selectedFields.map((field, index) => (
                      <div key={field.id} className="flex items-center gap-2 sm:gap-3 p-2 sm:p-3 bg-gradient-to-r from-gray-50 dark:from-gray-700 to-white dark:to-gray-800 rounded-lg sm:rounded-xl border border-gray-100 dark:border-gray-600 group hover:border-gray-200 dark:hover:border-gray-500 transition-all">
                        <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-full text-2xs sm:text-xs font-bold flex-shrink-0">
                          {index + 1}
                        </span>
                        <span className={cn(
                          "px-2 sm:px-2.5 py-0.5 sm:py-1 text-2xs sm:text-xs rounded-lg font-semibold flex-shrink-0",
                          field.source === 'transform' 
                            ? "bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300" 
                            : "bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300"
                        )}>
                          {field.source}
                        </span>
                        <code className="font-mono text-sm font-medium text-gray-700 dark:text-gray-300">{field.fieldPath}</code>
                        <ArrowRight className="h-4 w-4 text-gray-300 dark:text-gray-500" />
                        <input
                          type="text"
                          placeholder={field.fieldPath}
                          value={field.alias || ''}
                          onChange={(e) => updateFieldAlias(field.id, e.target.value)}
                          className="flex-1 min-w-0 px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm border-2 border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-mono focus:border-indigo-400 focus:ring-1 focus:ring-indigo-400 placeholder:text-gray-300 dark:placeholder:text-gray-500"
                        />
                        <button 
                          onClick={() => removeField(field.id)} 
                          className="p-1 sm:p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                        >
                          <Trash2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-10">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 mx-auto mb-2 sm:mb-3 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <ArrowRight className="h-5 w-5 sm:h-6 sm:w-6 text-gray-400" />
                    </div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-300">No fields selected</p>
                    <p className="text-2xs sm:text-xs text-gray-400 dark:text-gray-500 mt-1">Click fields on the left to add them</p>
                  </div>
                )}
              </div>
            </div>
            
            {/* Preview */}
            <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
              <div className="px-4 sm:px-5 lg:px-6 py-3 sm:py-4 lg:py-5 border-b dark:border-gray-700 bg-gradient-to-r from-slate-800 to-slate-700">
                <h3 className="text-sm sm:text-base lg:text-lg font-semibold text-white flex items-center gap-2">
                  <Database className="h-4 w-4 sm:h-5 sm:w-5" />
                  Response Preview
                </h3>
              </div>
              <div className="p-4 sm:p-5 lg:p-6 bg-slate-900">
                <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                  <span className={cn(
                    "px-3 sm:px-4 py-1 sm:py-1.5 text-base sm:text-lg font-bold rounded-lg",
                    config.statusCode < 400 
                      ? "bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30" 
                      : "bg-red-500/20 text-red-400 ring-1 ring-red-500/30"
                  )}>
                    {config.statusCode}
                  </span>
                  <span className="text-slate-400 text-xs sm:text-sm">
                    {HTTP_STATUS_CODES.find(s => s.code === config.statusCode)?.label.split(' ').slice(1).join(' ')}
                  </span>
                </div>
                <pre className="p-3 sm:p-4 bg-slate-950 text-emerald-400 rounded-lg sm:rounded-xl text-xs sm:text-sm overflow-auto font-mono leading-relaxed border border-slate-700 max-h-[200px] sm:max-h-[300px] lg:max-h-[400px]">
                  {JSON.stringify(previewBody, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
