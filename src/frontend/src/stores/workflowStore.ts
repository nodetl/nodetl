import { create } from 'zustand';
import type { Workflow, WorkflowNode, WorkflowEdge, NodeType, Schema } from '@/types';

// Connected node info for data selection
export interface ConnectedNodeInfo {
  node: WorkflowNode;
  direction: 'incoming' | 'outgoing';
  edge: WorkflowEdge;
}

// History state for undo/redo
interface HistoryState {
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
}

const MAX_HISTORY_SIZE = 50;

interface WorkflowState {
  // Current workflow being edited
  workflow: Workflow | null;
  setWorkflow: (workflow: Workflow | null) => void;
  
  // Project prefix for endpoint URLs
  projectPrefix: string;
  setProjectPrefix: (prefix: string) => void;
  
  // Nodes and edges for React Flow
  nodes: WorkflowNode[];
  edges: WorkflowEdge[];
  setNodes: (nodes: WorkflowNode[]) => void;
  setEdges: (edges: WorkflowEdge[]) => void;
  addNode: (node: WorkflowNode) => void;
  updateNode: (id: string, updates: Partial<WorkflowNode>) => void;
  removeNode: (id: string) => void;
  addEdge: (edge: WorkflowEdge) => void;
  removeEdge: (id: string) => void;
  
  // Undo/Redo
  history: HistoryState[];
  historyIndex: number;
  canUndo: () => boolean;
  canRedo: () => boolean;
  undo: () => void;
  redo: () => void;
  pushHistory: () => void;
  
  // Selected node for detail panel
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  getSelectedNode: () => WorkflowNode | null;
  
  // Get connected nodes (incoming nodes that feed data to this node)
  getConnectedNodes: (nodeId: string) => ConnectedNodeInfo[];
  // Get all incoming nodes recursively (for data flow)
  getUpstreamNodes: (nodeId: string) => WorkflowNode[];
  
  // Available node types
  nodeTypes: NodeType[];
  setNodeTypes: (types: NodeType[]) => void;
  
  // Available schemas
  schemas: Schema[];
  setSchemas: (schemas: Schema[]) => void;
  
  // UI state
  isDetailPanelOpen: boolean;
  setDetailPanelOpen: (open: boolean) => void;
  isMappingDialogOpen: boolean;
  setMappingDialogOpen: (open: boolean) => void;
  
  // Save status
  hasUnsavedChanges: boolean;
  setHasUnsavedChanges: (hasChanges: boolean) => void;
  
  // Track unsaved (new) node IDs
  unsavedNodeIds: Set<string>;
  addUnsavedNodeId: (id: string) => void;
  clearUnsavedNodeIds: () => void;
  isNodeUnsaved: (id: string) => boolean;
  
  // Reset
  reset: () => void;
}

const initialState = {
  workflow: null,
  nodes: [],
  edges: [],
  selectedNodeId: null,
  nodeTypes: [],
  schemas: [],
  isDetailPanelOpen: false,
  isMappingDialogOpen: false,
  hasUnsavedChanges: false,
  history: [] as HistoryState[],
  historyIndex: -1,
  unsavedNodeIds: new Set<string>(),
  projectPrefix: '/api/v1',
};

export const useWorkflowStore = create<WorkflowState>((set, get) => ({
  ...initialState,
  
  setProjectPrefix: (prefix) => set({ projectPrefix: prefix }),
  
  setWorkflow: (workflow) => set({ 
    workflow,
    nodes: workflow?.nodes || [],
    edges: workflow?.edges || [],
    hasUnsavedChanges: false,
    history: workflow ? [{ nodes: workflow.nodes || [], edges: workflow.edges || [] }] : [],
    historyIndex: workflow ? 0 : -1,
  }),
  
  // Push current state to history
  pushHistory: () => {
    const state = get();
    const currentState: HistoryState = {
      nodes: JSON.parse(JSON.stringify(state.nodes)),
      edges: JSON.parse(JSON.stringify(state.edges)),
    };
    
    // Remove any future history if we're not at the end
    const newHistory = state.history.slice(0, state.historyIndex + 1);
    newHistory.push(currentState);
    
    // Limit history size
    if (newHistory.length > MAX_HISTORY_SIZE) {
      newHistory.shift();
    }
    
    set({
      history: newHistory,
      historyIndex: newHistory.length - 1,
    });
  },
  
  canUndo: () => {
    const state = get();
    return state.historyIndex > 0;
  },
  
  canRedo: () => {
    const state = get();
    return state.historyIndex < state.history.length - 1;
  },
  
  undo: () => {
    const state = get();
    if (state.historyIndex > 0) {
      const newIndex = state.historyIndex - 1;
      const prevState = state.history[newIndex];
      set({
        nodes: JSON.parse(JSON.stringify(prevState.nodes)),
        edges: JSON.parse(JSON.stringify(prevState.edges)),
        historyIndex: newIndex,
        hasUnsavedChanges: true,
      });
    }
  },
  
  redo: () => {
    const state = get();
    if (state.historyIndex < state.history.length - 1) {
      const newIndex = state.historyIndex + 1;
      const nextState = state.history[newIndex];
      set({
        nodes: JSON.parse(JSON.stringify(nextState.nodes)),
        edges: JSON.parse(JSON.stringify(nextState.edges)),
        historyIndex: newIndex,
        hasUnsavedChanges: true,
      });
    }
  },
  
  setNodes: (nodes) => {
    get().pushHistory();
    set({ nodes, hasUnsavedChanges: true });
  },
  
  setEdges: (edges) => {
    get().pushHistory();
    set({ edges, hasUnsavedChanges: true });
  },
  
  addNode: (node) => {
    get().pushHistory();
    set((state) => ({ 
      nodes: [...state.nodes, node],
      hasUnsavedChanges: true,
    }));
  },
  
  updateNode: (id, updates) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.map((node) =>
        node.id === id ? { ...node, ...updates } : node
      ),
      hasUnsavedChanges: true,
    }));
  },
  
  removeNode: (id) => {
    get().pushHistory();
    set((state) => ({
      nodes: state.nodes.filter((node) => node.id !== id),
      edges: state.edges.filter((edge) => edge.source !== id && edge.target !== id),
      selectedNodeId: state.selectedNodeId === id ? null : state.selectedNodeId,
      hasUnsavedChanges: true,
    }));
  },
  
  addEdge: (edge) => {
    get().pushHistory();
    set((state) => ({
      edges: [...state.edges, edge],
      hasUnsavedChanges: true,
    }));
  },
  
  removeEdge: (id) => {
    get().pushHistory();
    set((state) => ({
      edges: state.edges.filter((edge) => edge.id !== id),
      hasUnsavedChanges: true,
    }));
  },
  
  setSelectedNodeId: (id) => set({ 
    selectedNodeId: id,
    isDetailPanelOpen: id !== null,
  }),
  
  getSelectedNode: () => {
    const state = get();
    if (!state.selectedNodeId) return null;
    return state.nodes.find((n) => n.id === state.selectedNodeId) || null;
  },
  
  getConnectedNodes: (nodeId: string) => {
    const state = get();
    const connectedNodes: ConnectedNodeInfo[] = [];
    
    // Find incoming edges (nodes that connect TO this node)
    state.edges.forEach((edge) => {
      if (edge.target === nodeId) {
        const sourceNode = state.nodes.find((n) => n.id === edge.source);
        if (sourceNode) {
          connectedNodes.push({
            node: sourceNode,
            direction: 'incoming',
            edge,
          });
        }
      }
      // Find outgoing edges (nodes that this node connects TO)
      if (edge.source === nodeId) {
        const targetNode = state.nodes.find((n) => n.id === edge.target);
        if (targetNode) {
          connectedNodes.push({
            node: targetNode,
            direction: 'outgoing',
            edge,
          });
        }
      }
    });
    
    return connectedNodes;
  },
  
  getUpstreamNodes: (nodeId: string) => {
    const state = get();
    const visited = new Set<string>();
    const upstreamNodes: WorkflowNode[] = [];
    
    const traverse = (currentNodeId: string) => {
      if (visited.has(currentNodeId)) return;
      visited.add(currentNodeId);
      
      // Find all incoming edges
      state.edges.forEach((edge) => {
        if (edge.target === currentNodeId) {
          const sourceNode = state.nodes.find((n) => n.id === edge.source);
          if (sourceNode && !visited.has(sourceNode.id)) {
            upstreamNodes.push(sourceNode);
            traverse(sourceNode.id);
          }
        }
      });
    };
    
    traverse(nodeId);
    return upstreamNodes;
  },

  setNodeTypes: (nodeTypes) => set({ nodeTypes }),
  
  setSchemas: (schemas) => set({ schemas }),
  
  setDetailPanelOpen: (isDetailPanelOpen) => set({ isDetailPanelOpen }),
  
  setMappingDialogOpen: (isMappingDialogOpen) => set({ isMappingDialogOpen }),
  
  setHasUnsavedChanges: (hasUnsavedChanges) => set({ hasUnsavedChanges }),
  
  // Unsaved node tracking
  addUnsavedNodeId: (id) => {
    set((state) => {
      const newSet = new Set(state.unsavedNodeIds);
      newSet.add(id);
      return { unsavedNodeIds: newSet };
    });
  },
  
  clearUnsavedNodeIds: () => set({ unsavedNodeIds: new Set() }),
  
  isNodeUnsaved: (id) => get().unsavedNodeIds.has(id),
  
  reset: () => set({ ...initialState, unsavedNodeIds: new Set() }),
}));
