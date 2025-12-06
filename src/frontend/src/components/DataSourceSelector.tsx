import { useState, useMemo } from 'react';
import { 
  ChevronDown, 
  ChevronRight, 
  ArrowRight,
  Search,
  Layers,
  FileJson,
  Hash,
  Type,
  ToggleLeft,
  Braces,
  Brackets,
  Check,
} from 'lucide-react';
import { useWorkflowStore } from '@/stores/workflowStore';
import { cn, getNodeColor } from '@/lib/utils';
import type { WorkflowNode, Schema } from '@/types';

// Field info from a node's output
export interface NodeOutputField {
  id: string;
  name: string;
  path: string;  // Full path like "data.user.email"
  type: string;
  sourceNodeId: string;
  sourceNodeLabel: string;
  sourceNodeType: string;
}

interface DataSourceSelectorProps {
  nodeId: string;
  selectedFields?: NodeOutputField[];
  onFieldSelect: (field: NodeOutputField) => void;
  onFieldDeselect?: (fieldId: string) => void;
  multiSelect?: boolean;
  className?: string;
}

// Get icon for field type
function getFieldIcon(type: string) {
  switch (type) {
    case 'string': return Type;
    case 'number': case 'integer': return Hash;
    case 'boolean': return ToggleLeft;
    case 'object': return Braces;
    case 'array': return Brackets;
    default: return FileJson;
  }
}

// Extract output fields from a node
function getNodeOutputFields(node: WorkflowNode, schemas: Schema[]): NodeOutputField[] {
  const fields: NodeOutputField[] = [];
  
  switch (node.type) {
    case 'trigger':
      // Trigger outputs the incoming request data
      // If webhook, output body, headers, query params
      fields.push({
        id: `${node.id}_body`,
        name: 'body',
        path: 'body',
        type: 'object',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      fields.push({
        id: `${node.id}_headers`,
        name: 'headers',
        path: 'headers',
        type: 'object',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      fields.push({
        id: `${node.id}_query`,
        name: 'query',
        path: 'query',
        type: 'object',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      break;
      
    case 'transform':
      // Transform outputs based on target schema
      if (node.data.targetSchemaId) {
        const schema = schemas.find(s => s.id === node.data.targetSchemaId);
        if (schema?.fields) {
          schema.fields.forEach(field => {
            fields.push({
              id: `${node.id}_${field.name}`,
              name: field.name,
              path: field.name,
              type: field.type,
              sourceNodeId: node.id,
              sourceNodeLabel: node.label,
              sourceNodeType: node.type,
            });
          });
        }
      }
      // Also include mapping rules as output
      if (node.data.mappingRules) {
        node.data.mappingRules.forEach(rule => {
          if (!fields.find(f => f.name === rule.targetField)) {
            fields.push({
              id: `${node.id}_${rule.targetField}`,
              name: rule.targetField,
              path: rule.targetField,
              type: 'any',
              sourceNodeId: node.id,
              sourceNodeLabel: node.label,
              sourceNodeType: node.type,
            });
          }
        });
      }
      break;
      
    case 'http':
      // HTTP outputs response data
      fields.push({
        id: `${node.id}_response`,
        name: 'response',
        path: 'response',
        type: 'object',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      fields.push({
        id: `${node.id}_status`,
        name: 'status',
        path: 'status',
        type: 'number',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      fields.push({
        id: `${node.id}_headers`,
        name: 'headers',
        path: 'headers',
        type: 'object',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      break;
      
    case 'code':
      // Code node outputs result
      fields.push({
        id: `${node.id}_result`,
        name: 'result',
        path: 'result',
        type: 'any',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      break;
      
    case 'condition':
      // Condition passes through data
      fields.push({
        id: `${node.id}_matched`,
        name: 'matched',
        path: 'matched',
        type: 'boolean',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      fields.push({
        id: `${node.id}_data`,
        name: 'data',
        path: 'data',
        type: 'object',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      break;
      
    case 'loop':
      // Loop outputs current item and index
      fields.push({
        id: `${node.id}_item`,
        name: 'item',
        path: 'item',
        type: 'any',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      fields.push({
        id: `${node.id}_index`,
        name: 'index',
        path: 'index',
        type: 'number',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      fields.push({
        id: `${node.id}_items`,
        name: 'items',
        path: 'items',
        type: 'array',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
      break;
      
    default:
      // Generic output
      fields.push({
        id: `${node.id}_output`,
        name: 'output',
        path: 'output',
        type: 'any',
        sourceNodeId: node.id,
        sourceNodeLabel: node.label,
        sourceNodeType: node.type,
      });
  }
  
  return fields;
}

export default function DataSourceSelector({
  nodeId,
  selectedFields = [],
  onFieldSelect,
  onFieldDeselect,
  multiSelect = true,
  className,
}: DataSourceSelectorProps) {
  const { getUpstreamNodes, schemas } = useWorkflowStore();
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  
  // Get all upstream nodes (nodes that can provide data to this node)
  const upstreamNodes = useMemo(() => {
    return getUpstreamNodes(nodeId);
  }, [nodeId, getUpstreamNodes]);
  
  // Get output fields for each upstream node
  const nodeOutputs = useMemo(() => {
    const outputs: Map<string, NodeOutputField[]> = new Map();
    
    upstreamNodes.forEach(node => {
      const fields = getNodeOutputFields(node, schemas);
      outputs.set(node.id, fields);
    });
    
    return outputs;
  }, [upstreamNodes, schemas]);
  
  // Filter fields by search query
  const filteredOutputs = useMemo(() => {
    if (!searchQuery.trim()) return nodeOutputs;
    
    const filtered: Map<string, NodeOutputField[]> = new Map();
    const query = searchQuery.toLowerCase();
    
    nodeOutputs.forEach((fields, nodeId) => {
      const matchingFields = fields.filter(f => 
        f.name.toLowerCase().includes(query) || 
        f.path.toLowerCase().includes(query) ||
        f.sourceNodeLabel.toLowerCase().includes(query)
      );
      if (matchingFields.length > 0) {
        filtered.set(nodeId, matchingFields);
      }
    });
    
    return filtered;
  }, [nodeOutputs, searchQuery]);
  
  const toggleNodeExpand = (nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };
  
  const isFieldSelected = (fieldId: string) => {
    return selectedFields.some(f => f.id === fieldId);
  };
  
  const handleFieldClick = (field: NodeOutputField) => {
    if (isFieldSelected(field.id)) {
      onFieldDeselect?.(field.id);
    } else {
      onFieldSelect(field);
    }
  };
  
  if (upstreamNodes.length === 0) {
    return (
      <div className={cn("p-4 text-center text-gray-500 bg-gray-50 rounded-lg border border-dashed", className)}>
        <Layers size={32} className="mx-auto mb-2 opacity-50" />
        <p className="text-sm">No connected nodes</p>
        <p className="text-xs text-gray-400 mt-1">
          Connect nodes to access their output data
        </p>
      </div>
    );
  }
  
  return (
    <div className={cn("border rounded-lg overflow-hidden", className)}>
      {/* Search */}
      <div className="p-2 border-b bg-gray-50">
        <div className="relative">
          <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search fields..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
      </div>
      
      {/* Node list */}
      <div className="max-h-[400px] overflow-y-auto">
        {upstreamNodes.map(node => {
          const fields = filteredOutputs.get(node.id) || [];
          const isExpanded = expandedNodes.has(node.id);
          const nodeColor = getNodeColor(node.type);
          const hasSelectedFields = fields.some(f => isFieldSelected(f.id));
          
          if (fields.length === 0 && searchQuery) return null;
          
          return (
            <div key={node.id} className="border-b last:border-b-0">
              {/* Node header */}
              <button
                onClick={() => toggleNodeExpand(node.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 transition-colors",
                  hasSelectedFields && "bg-blue-50"
                )}
              >
                {isExpanded ? (
                  <ChevronDown size={16} className="text-gray-400" />
                ) : (
                  <ChevronRight size={16} className="text-gray-400" />
                )}
                <div 
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: nodeColor }}
                />
                <span className="font-medium text-sm flex-1 text-left truncate">
                  {node.label}
                </span>
                <span className="text-xs text-gray-400 capitalize">{node.type}</span>
                <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                  {fields.length}
                </span>
              </button>
              
              {/* Fields list */}
              {isExpanded && fields.length > 0 && (
                <div className="bg-gray-50 border-t">
                  {fields.map(field => {
                    const FieldIcon = getFieldIcon(field.type);
                    const selected = isFieldSelected(field.id);
                    
                    return (
                      <button
                        key={field.id}
                        onClick={() => handleFieldClick(field)}
                        className={cn(
                          "w-full flex items-center gap-2 px-3 py-2 pl-9 hover:bg-gray-100 transition-colors text-left",
                          selected && "bg-blue-100 hover:bg-blue-100"
                        )}
                      >
                        <FieldIcon size={14} className="text-gray-400 flex-shrink-0" />
                        <span className="text-sm flex-1 truncate font-mono">
                          {field.path}
                        </span>
                        <span className="text-xs text-gray-400">{field.type}</span>
                        {multiSelect && selected && (
                          <Check size={14} className="text-blue-600" />
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
      
      {/* Selected count */}
      {multiSelect && selectedFields.length > 0 && (
        <div className="px-3 py-2 bg-blue-50 border-t text-sm text-blue-700">
          {selectedFields.length} field{selectedFields.length > 1 ? 's' : ''} selected
        </div>
      )}
    </div>
  );
}

// Compact version for inline use
export function DataSourceBadge({ field }: { field: NodeOutputField }) {
  const nodeColor = getNodeColor(field.sourceNodeType);
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-gray-100 rounded text-xs">
      <span 
        className="w-2 h-2 rounded-full" 
        style={{ backgroundColor: nodeColor }}
      />
      <span className="text-gray-500">{field.sourceNodeLabel}</span>
      <ArrowRight size={10} className="text-gray-400" />
      <span className="font-mono text-gray-700">{field.path}</span>
    </span>
  );
}

// Export helper function for external use
export { getNodeOutputFields };
