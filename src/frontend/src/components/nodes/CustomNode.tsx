import { memo, useCallback } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import { useNavigate, useParams } from 'react-router-dom';
import { 
  Play, Shuffle, Globe, GitBranch, Repeat, Code, Clock, 
  Mail, Webhook, Box, Trash2, ExternalLink, LucideIcon, AlertCircle
} from 'lucide-react';
import { cn, getNodeColor } from '@/lib/utils';
import { useWorkflowStore } from '@/stores/workflowStore';
import type { WorkflowNode } from '@/types';

const iconMap: Record<string, LucideIcon> = {
  trigger: Play,
  transform: Shuffle,
  http: Globe,
  condition: GitBranch,
  loop: Repeat,
  code: Code,
  delay: Clock,
  email: Mail,
  webhook: Webhook,
  response: Box,
};

interface CustomNodeData extends WorkflowNode {
  onDelete?: (id: string) => void;
}

// Node types that can be edited
const EDITABLE_TYPES = ['transform', 'response', 'http', 'code', 'condition'];

function CustomNode({ id, data, selected }: NodeProps<CustomNodeData>) {
  const { setSelectedNodeId, removeNode, isNodeUnsaved } = useWorkflowStore();
  const navigate = useNavigate();
  const { id: workflowId } = useParams<{ id: string }>();
  
  const color = getNodeColor(data.type);
  const Icon = iconMap[data.type] || Box;
  const isEditable = EDITABLE_TYPES.includes(data.type);
  const isUnsaved = isNodeUnsaved(id);
  
  const handleClick = useCallback(() => {
    setSelectedNodeId(id);
  }, [id, setSelectedNodeId]);
  
  const openDetail = useCallback(() => {
    if (!workflowId || workflowId === 'new' || !isEditable) return;
    if (isUnsaved) {
      alert('Please save the workflow first before editing this node.');
      return;
    }
    navigate(`/workflows/${workflowId}/n/${id}`);
  }, [workflowId, id, isEditable, isUnsaved, navigate]);
  
  const handleDelete = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    removeNode(id);
  }, [id, removeNode]);
  
  // Get output config based on node type
  const outputs = getNodeOutputs(data.type);
  
  return (
    <div
      className={cn(
        'workflow-node bg-white min-w-[180px]',
        selected && 'ring-2 ring-blue-500'
      )}
      style={{ borderColor: color }}
      onClick={handleClick}
      onDoubleClick={openDetail}
    >
      {/* Input Handle */}
      {data.type !== 'trigger' && (
        <Handle
          type="target"
          position={Position.Left}
          className="!w-3 !h-3"
          style={{ backgroundColor: color }}
        />
      )}
      
      {/* Header */}
      <div 
        className="workflow-node-header text-white"
        style={{ backgroundColor: color }}
      >
        <Icon size={16} />
        <span className="font-medium text-sm flex-1 truncate">{data.label}</span>
        {isUnsaved && (
          <span 
            className="opacity-80" 
            title="Node not saved - save workflow to edit"
          >
            <AlertCircle size={14} />
          </span>
        )}
        <button
          onClick={handleDelete}
          className="opacity-60 hover:opacity-100 transition-opacity"
        >
          <Trash2 size={14} />
        </button>
      </div>
      
      {/* Body */}
      <div className="workflow-node-body relative">
        <p className="text-gray-500 dark:text-gray-400 truncate text-xs">
          {getNodeDescription(data)}
        </p>
        
        {/* Edit button for editable nodes */}
        {isEditable && (
          <button
            onClick={(e) => { e.stopPropagation(); openDetail(); }}
            className="absolute right-1 top-1 p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300"
            title="Edit"
          >
            <ExternalLink size={12} />
          </button>
        )}
        
        {/* Output labels for multiple outputs */}
        {outputs.length > 1 && (
          <div className="mt-2 flex flex-col gap-1">
            {outputs.map((out, i) => (
              <div 
                key={out.id}
                className="flex items-center justify-end gap-1 text-2xs"
                style={{ 
                  marginTop: i === 0 ? 0 : 4,
                  color: out.color 
                }}
              >
                <span className="font-medium">{out.label}</span>
                <div 
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: out.color }}
                />
              </div>
            ))}
          </div>
        )}
      </div>
      
      {/* Output Handles */}
      {outputs.length > 1 ? (
        outputs.map((out, i) => (
          <Handle
            key={out.id}
            type="source"
            position={Position.Right}
            id={out.id}
            className="!w-3 !h-3"
            style={{ 
              backgroundColor: out.color,
              top: `${30 + ((i + 1) / (outputs.length + 1)) * 70}%`
            }}
          />
        ))
      ) : (
        <Handle
          type="source"
          position={Position.Right}
          className="!w-3 !h-3"
          style={{ backgroundColor: color }}
        />
      )}
    </div>
  );
}

// Get output handles config for node type
function getNodeOutputs(type: string): Array<{ id: string; label: string; color: string }> {
  switch (type) {
    case 'condition':
      return [
        { id: 'true', label: 'Yes', color: '#10B981' },
        { id: 'false', label: 'No', color: '#EF4444' },
      ];
    case 'loop':
      return [
        { id: 'item', label: 'Each', color: '#EC4899' },
        { id: 'done', label: 'Done', color: '#6B7280' },
      ];
    default:
      return [{ id: 'default', label: '', color: getNodeColor(type) }];
  }
}

function getNodeDescription(node: WorkflowNode): string {
  const { type, data } = node;
  
  switch (type) {
    case 'trigger':
      return data?.triggerType === 'webhook' 
        ? `Webhook: ${data?.webhookPath || '/...'}` 
        : data?.triggerType || 'Start';
    case 'transform':
      return `${data?.mappingRules?.length || 0} mappings`;
    case 'http':
      return data?.httpMethod 
        ? `${data.httpMethod} ${(data.httpUrl || '').slice(0, 15)}...` 
        : 'HTTP Request';
    case 'condition':
      return `${data?.conditions?.length || 0} conditions`;
    case 'loop':
      return data?.loopType || 'Loop';
    case 'code':
      return 'Custom code';
    case 'delay':
      return 'Wait/Delay';
    case 'response':
      return `Status ${data?.responseConfig?.statusCode || 200}`;
    default:
      return type;
  }
}

export default memo(CustomNode);
