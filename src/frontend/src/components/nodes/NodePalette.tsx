import { useMemo } from 'react';
import { 
  Play, Shuffle, Globe, GitBranch, Repeat, Code, Clock, 
  Mail, Webhook, Box, GripVertical, Send, Loader2, LucideIcon
} from 'lucide-react';
import { cn, getNodeColor } from '@/lib/utils';
import type { NodeType } from '@/types';

const iconMap: Record<string, LucideIcon> = {
  play: Play,
  shuffle: Shuffle,
  globe: Globe,
  'git-branch': GitBranch,
  repeat: Repeat,
  code: Code,
  clock: Clock,
  mail: Mail,
  webhook: Webhook,
  box: Box,
  send: Send,
};

interface NodePaletteProps {
  nodeTypes: NodeType[];
  onDragStart: (event: React.DragEvent, nodeType: NodeType) => void;
  isLoading?: boolean;
}

export default function NodePalette({ nodeTypes, onDragStart, isLoading }: NodePaletteProps) {
  const groupedTypes = useMemo(() => {
    const groups: Record<string, NodeType[]> = {};
    
    nodeTypes.forEach((nt) => {
      if (!groups[nt.category]) {
        groups[nt.category] = [];
      }
      groups[nt.category].push(nt);
    });
    
    return groups;
  }, [nodeTypes]);
  
  const categoryLabels: Record<string, string> = {
    trigger: '🚀 Triggers',
    action: '⚡ Actions',
    logic: '🔀 Logic',
    transform: '🔄 Transform',
    custom: '🧩 Custom',
  };
  
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center p-8">
          <Loader2 className="animate-spin text-gray-400 dark:text-gray-500" size={24} />
        </div>
      );
    }
    
    if (nodeTypes.length === 0) {
      return (
        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
          No node types available
        </div>
      );
    }
    
    return (
      <div className="p-3 space-y-4">
        {Object.entries(groupedTypes).map(([category, types]) => (
          <div key={category}>
            <h3 className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
              {categoryLabels[category] || category}
            </h3>
            
            <div className="space-y-2">
              {types.map((nodeType) => {
                const Icon = iconMap[nodeType.icon] || Box;
                const color = nodeType.color || getNodeColor(nodeType.type);
                
                return (
                  <div
                    key={nodeType.type}
                    className={cn(
                      'flex items-center gap-2 p-2 rounded-lg cursor-grab',
                      'border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800',
                      'hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600',
                      'transition-all duration-150',
                      'active:cursor-grabbing'
                    )}
                    draggable
                    onDragStart={(e) => onDragStart(e, nodeType)}
                  >
                    <GripVertical size={14} className="text-gray-400 dark:text-gray-500" />
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center"
                      style={{ backgroundColor: color }}
                    >
                      <Icon size={16} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 dark:text-gray-200 truncate">
                        {nodeType.name}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {nodeType.description}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    );
  };
  
  return (
    <div className="w-64 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="font-semibold text-gray-800 dark:text-gray-200">Node Palette</h2>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Drag nodes to canvas</p>
      </div>
      {renderContent()}
    </div>
  );
}
