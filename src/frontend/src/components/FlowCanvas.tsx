import { useCallback, useRef, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Connection,
  Node,
  Edge,
  NodeTypes,
  ReactFlowProvider,
  useReactFlow,
} from 'reactflow';
import 'reactflow/dist/style.css';

import CustomNode from '@/components/nodes/CustomNode';
import NodePalette from '@/components/nodes/NodePalette';
import NodeDetailPanel from '@/components/nodes/NodeDetailPanel';
import MappingDialog from '@/components/mapping/MappingDialog';
import { useWorkflowStore } from '@/stores/workflowStore';
import { generateId, getNodeColor } from '@/lib/utils';
import type { NodeType, WorkflowNode, WorkflowEdge } from '@/types';

const nodeTypes: NodeTypes = {
  custom: CustomNode,
};

interface FlowCanvasProps {
  nodeTypes?: any[];
  schemas?: any[];
  isLoadingNodeTypes?: boolean;
  isLoadingSchemas?: boolean;
}

function FlowCanvasInner({ 
  nodeTypes: propNodeTypes = [], 
  schemas: propSchemas = [],
  isLoadingNodeTypes = false,
  isLoadingSchemas: _isLoadingSchemas = false,
}: FlowCanvasProps) {
  const reactFlowWrapper = useRef<HTMLDivElement>(null);
  const { project } = useReactFlow();
  const { id: workflowId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  
  const {
    nodes: storeNodes,
    edges: storeEdges,
    setNodes: setStoreNodes,
    setEdges: setStoreEdges,
    selectedNodeId,
    setSelectedNodeId,
    setNodeTypes,
    setSchemas,
    isDetailPanelOpen,
    setDetailPanelOpen,
    isMappingDialogOpen,
    setMappingDialogOpen,
    getSelectedNode,
    updateNode,
    undo,
    redo,
    canUndo,
    canRedo,
    addUnsavedNodeId,
    isNodeUnsaved,
  } = useWorkflowStore();
  
  // Keyboard shortcuts for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in input/textarea
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Ctrl+Z or Cmd+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        if (canUndo()) {
          undo();
        }
      }
      
      // Ctrl+Y or Cmd+Shift+Z = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        if (canRedo()) {
          redo();
        }
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undo, redo, canUndo, canRedo]);
  
  // Sync props to store
  useEffect(() => {
    if (propNodeTypes.length > 0) {
      setNodeTypes(propNodeTypes);
    }
  }, [propNodeTypes, setNodeTypes]);
  
  useEffect(() => {
    if (propSchemas.length > 0) {
      setSchemas(propSchemas);
    }
  }, [propSchemas, setSchemas]);
  
  // Convert store nodes to ReactFlow nodes
  const reactFlowNodes: Node[] = storeNodes.map((node) => ({
    id: node.id,
    type: 'custom',
    position: node.position,
    data: node,
    selected: node.id === selectedNodeId,
  }));
  
  // Convert store edges to ReactFlow edges
  const reactFlowEdges: Edge[] = storeEdges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    sourceHandle: edge.sourceHandle,
    targetHandle: edge.targetHandle,
    label: edge.label,
    animated: true,
    style: { stroke: '#6366F1' },
  }));
  
  const [nodes, setNodes, onNodesChange] = useNodesState(reactFlowNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(reactFlowEdges);
  
  // Sync ReactFlow state back to store
  useEffect(() => {
    setNodes(reactFlowNodes);
  }, [storeNodes, selectedNodeId]);
  
  useEffect(() => {
    setEdges(reactFlowEdges);
  }, [storeEdges]);
  
  // Handle node changes
  const handleNodesChange = useCallback((changes: any) => {
    onNodesChange(changes);
  }, [onNodesChange]);
  
  // Handle node drag stop - update store when drag ends
  const handleNodeDragStop = useCallback((_event: React.MouseEvent, node: Node) => {
    console.log('[FlowCanvas] Node drag stopped:', node.id, node.position);
    const storeNode = storeNodes.find(n => n.id === node.id);
    if (storeNode && (
      Math.abs(storeNode.position.x - node.position.x) > 0.1 ||
      Math.abs(storeNode.position.y - node.position.y) > 0.1
    )) {
      console.log('[FlowCanvas] Updating store with new position');
      updateNode(node.id, { position: node.position });
    }
  }, [storeNodes, updateNode]);
  
  // Handle edge connection
  const onConnect = useCallback((params: Connection) => {
    const newEdge: WorkflowEdge = {
      id: generateId(),
      source: params.source!,
      target: params.target!,
      sourceHandle: params.sourceHandle || undefined,
      targetHandle: params.targetHandle || undefined,
    };
    
    setStoreEdges([...storeEdges, newEdge]);
  }, [storeEdges, setStoreEdges]);
  
  // Handle node click
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    console.log('Node clicked:', { id: node.id, type: node.data?.type, data: node.data });
    setSelectedNodeId(node.id);
    // Navigate to node detail page for transform and response nodes
    if (node.data?.type === 'transform' || node.data?.type === 'response') {
      setDetailPanelOpen(false);
      if (workflowId && workflowId !== 'new') {
        // Check if node is unsaved
        if (isNodeUnsaved(node.id)) {
          alert('Please save the workflow first before editing this node.');
          return;
        }
        const targetUrl = `/workflows/${workflowId}/n/${node.id}`;
        console.log('Navigating to:', targetUrl);
        navigate(targetUrl);
      }
    }
  }, [setSelectedNodeId, setDetailPanelOpen, workflowId, navigate, isNodeUnsaved]);
  
  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
  }, [setSelectedNodeId]);
  
  // Handle drag over (for node palette)
  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);
  
  // Handle drop (add new node)
  const onDrop = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    
    const nodeTypeData = event.dataTransfer.getData('application/reactflow');
    if (!nodeTypeData) return;
    
    const nodeType: NodeType = JSON.parse(nodeTypeData);
    
    if (!reactFlowWrapper.current) return;
    
    const reactFlowBounds = reactFlowWrapper.current.getBoundingClientRect();
    const position = project({
      x: event.clientX - reactFlowBounds.left,
      y: event.clientY - reactFlowBounds.top,
    });
    
    const newNode: WorkflowNode = {
      id: generateId(),
      type: nodeType.type,
      label: nodeType.name,
      position,
      data: {
        description: nodeType.description,
      },
      inputs: nodeType.inputs.map((input, i) => ({
        id: `in-${i}`,
        name: input.name,
        type: input.type,
      })),
      outputs: nodeType.outputs.map((output, i) => ({
        id: `out-${i}`,
        name: output.name,
        type: output.type,
      })),
    };
    
    // Mark this node as unsaved (new)
    addUnsavedNodeId(newNode.id);
    setStoreNodes([...storeNodes, newNode]);
  }, [project, storeNodes, setStoreNodes, addUnsavedNodeId]);
  
  // Drag start handler for palette
  const handleDragStart = (event: React.DragEvent, nodeType: NodeType) => {
    event.dataTransfer.setData('application/reactflow', JSON.stringify(nodeType));
    event.dataTransfer.effectAllowed = 'move';
  };
  
  // Get selected node data for panels
  const selectedNode = getSelectedNode();
  
  return (
    <div className="flex h-full">
      {/* Node Palette */}
      <NodePalette 
        nodeTypes={propNodeTypes}
        onDragStart={handleDragStart}
        isLoading={isLoadingNodeTypes}
      />
      
      {/* Canvas */}
      <div className="flex-1 h-full" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={handleNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onNodeDragStop={handleNodeDragStop}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{
            animated: true,
            style: { stroke: '#6366F1', strokeWidth: 2 },
          }}
          className="bg-gray-50 dark:bg-gray-800"
        >
          <Background color="#94a3b8" gap={16} className="dark:opacity-30" />
          <Controls className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700 !shadow-lg [&>button]:!bg-white [&>button]:dark:!bg-gray-800 [&>button]:!border-gray-200 [&>button]:dark:!border-gray-700 [&>button]:hover:!bg-gray-100 [&>button]:dark:hover:!bg-gray-700" />
          <MiniMap
            nodeColor={(node) => getNodeColor(node.data?.type || 'default')}
            maskColor="rgba(0, 0, 0, 0.1)"
            className="!bg-white dark:!bg-gray-800 !border-gray-200 dark:!border-gray-700"
          />
        </ReactFlow>
      </div>
      
      {/* Detail Panel */}
      {isDetailPanelOpen && selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setDetailPanelOpen(false)}
        />
      )}
      
      {/* Mapping Dialog */}
      {isMappingDialogOpen && selectedNode?.type === 'transform' && (
        <MappingDialog
          isOpen={isMappingDialogOpen}
          onClose={() => setMappingDialogOpen(false)}
          sourceSchemaId={selectedNode.data.sourceSchemaId || ''}
          targetSchemaId={selectedNode.data.targetSchemaId || ''}
          existingRules={selectedNode.data.mappingRules || []}
          onSave={(rules) => {
            updateNode(selectedNode.id, {
              data: { ...selectedNode.data, mappingRules: rules },
            });
          }}
        />
      )}
    </div>
  );
}

export default function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
