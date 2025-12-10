import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Save, Play, Loader2, Settings, Activity, Plus, Trash2, Copy, Check, Terminal, X, Code, Undo2, Redo2, Cloud, CloudOff } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi, nodeTypesApi, projectsApi } from '@/api';
import { useWorkflowStore } from '@/stores/workflowStore';
import { useAuthStore } from '@/stores/authStore';
import FlowCanvas from '@/components/FlowCanvas';
import type { WorkflowNode, WorkflowEdge, Project } from '@/types';

interface HeaderItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

export default function WorkflowEditorPage() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const isNew = id === 'new';
  const initialVersionTag = searchParams.get('version') || '1.0.0';
  const initialProjectId = searchParams.get('projectId') || '';
  const hasPermission = useAuthStore((state) => state.hasPermission);
  
  // Check permissions
  const canEdit = hasPermission('workflows', 'edit');
  const canExecute = hasPermission('workflows', 'execute');
  
  const {
    workflow,
    nodes,
    edges,
    setWorkflow,
    reset,
    undo,
    redo,
    canUndo,
    canRedo,
    clearUnsavedNodeIds,
    setProjectPrefix,
  } = useWorkflowStore();
  
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [versionTag, setVersionTag] = useState(initialVersionTag);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(initialProjectId);
  const [autoSaveEnabled, setAutoSaveEnabled] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [showTestPanel, setShowTestPanel] = useState(false);
  const [testHeaders, setTestHeaders] = useState<HeaderItem[]>([
    { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
  ]);
  const [testBody, setTestBody] = useState('{\n  "test": true\n}');
  const [testMethod, setTestMethod] = useState<'GET' | 'POST' | 'PUT' | 'DELETE'>('POST');
  const [copiedCurl, setCopiedCurl] = useState(false);
  
  // Load workflow
  const { data: workflowData, isLoading: isLoadingWorkflow } = useQuery({
    queryKey: ['workflow', id],
    queryFn: () => workflowsApi.get(id!),
    enabled: !isNew && !!id,
  });
  
  // Effect to handle workflow data
  useEffect(() => {
    if (workflowData) {
      const wf = workflowData;
      setWorkflow(wf);
      setName(wf.name);
      setDescription(wf.description || '');
      setVersionTag(wf.versionTag || '1.0.0');
      // Load project ID if saved
      if (wf.projectId) {
        setSelectedProjectId(wf.projectId);
      }
      if (wf.settings) {
        setAutoSaveEnabled(wf.settings.autoSaveEnabled !== false);
      }
    }
  }, [workflowData, setWorkflow]);
  
  // Load node types
  const { data: nodeTypesData, isLoading: isLoadingNodeTypes } = useQuery({
    queryKey: ['nodeTypes'],
    queryFn: () => nodeTypesApi.list(),
  });
  
  // Load projects for settings
  const { data: projectsData } = useQuery({
    queryKey: ['projects'],
    queryFn: () => projectsApi.list(1, 100),
  });
  
  // Auto-select Default project only if:
  // 1. This is a NEW workflow (not editing existing)
  // 2. No project was specified in URL params
  // 3. Projects have loaded
  useEffect(() => {
    if (isNew && !initialProjectId && !selectedProjectId && projectsData?.data) {
      const defaultProject = projectsData.data.find((p: Project) => p.name === 'Default');
      if (defaultProject) {
        setSelectedProjectId(defaultProject.id);
      }
    }
  }, [isNew, initialProjectId, selectedProjectId, projectsData]);
  
  // Get selected project for pathPrefix
  const selectedProject = useMemo(() => {
    if (!selectedProjectId || !projectsData?.data) return null;
    return projectsData.data.find((p: Project) => p.id === selectedProjectId);
  }, [selectedProjectId, projectsData]);
  
  // Computed endpoint prefix based on project or versionTag
  const endpointPrefix = useMemo(() => {
    if (selectedProject) {
      // Use pathPrefix from project, or generate from versionTag if not set
      return selectedProject.pathPrefix || `/api/${selectedProject.versionTag}`;
    }
    return `/api/${versionTag || '1.0.0'}`;
  }, [selectedProject, versionTag]);
  
  // Update store with project prefix when it changes
  useEffect(() => {
    setProjectPrefix(endpointPrefix);
  }, [endpointPrefix, setProjectPrefix]);
  
  // Get trigger node for endpoint config
  const triggerNode = useMemo(() => {
    return nodes.find((n: WorkflowNode) => n.type === 'trigger');
  }, [nodes]);
  
  // Get all trigger nodes for multi-endpoint workflows
  const triggerNodes = useMemo(() => {
    return nodes.filter((n: WorkflowNode) => n.type === 'trigger');
  }, [nodes]);
  
  // Computed full endpoint path from trigger node config
  const fullEndpointPath = useMemo(() => {
    const webhookPath = triggerNode?.data?.webhookPath || id || 'workflow';
    const cleanPath = webhookPath.replace(/^\/+/, ''); // Remove leading slashes
    return `${endpointPrefix}/${cleanPath}`;
  }, [endpointPrefix, triggerNode, id]);
  
  // Compute all endpoint paths for multi-trigger workflows
  const allEndpointPaths = useMemo(() => {
    return triggerNodes.map((trigger: WorkflowNode) => {
      const webhookPath = trigger.data?.webhookPath || id || 'workflow';
      const cleanPath = webhookPath.replace(/^\/+/, '');
      return {
        id: trigger.id,
        label: trigger.label || trigger.data?.webhookPath || 'Trigger',
        method: trigger.data?.webhookMethod || 'POST',
        path: `${endpointPrefix}/${cleanPath}`,
      };
    });
  }, [triggerNodes, endpointPrefix, id]);
  
  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      // Convert back to workflow format
      const workflowNodes: WorkflowNode[] = nodes.map((n: WorkflowNode) => ({
        id: n.id,
        label: n.label,
        type: n.type,
        position: n.position,
        data: n.data,
      }));
      
      const workflowEdges: WorkflowEdge[] = edges.map((e: WorkflowEdge) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));
      
      // Get endpoint config from trigger node
      const triggerData = triggerNode?.data || {};
      const webhookMethod = triggerData.webhookMethod || 'POST';
      const webhookHeaders = triggerData.webhookHeaders || {};
      
      const payload = {
        name,
        description,
        versionTag,
        projectId: selectedProjectId || undefined,
        nodes: workflowNodes,
        edges: workflowEdges,
        endpoint: {
          path: fullEndpointPath,
          method: webhookMethod,
          authType: workflow?.endpoint?.authType || 'none',
          headers: Object.keys(webhookHeaders).length > 0 ? webhookHeaders : undefined,
        },
        settings: {
          autoSaveEnabled,
          webhookPath: fullEndpointPath,
        },
      };
      
      if (isNew) {
        return workflowsApi.create(payload);
      } else {
        return workflowsApi.update(id!, payload);
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workflows'] });
      // Clear unsaved node IDs after successful save
      clearUnsavedNodeIds();
      if (isNew) {
        navigate(`/workflows/${data.id}`, { replace: true });
      }
    },
  });
  
  // Activate/Deactivate
  const activateMutation = useMutation({
    mutationFn: () => workflowsApi.activate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
  
  const deactivateMutation = useMutation({
    mutationFn: () => workflowsApi.deactivate(id!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workflow', id] });
    },
  });
  
  // Test execution
  const testMutation = useMutation({
    mutationFn: (testData: any) => workflowsApi.execute(id!, testData),
  });
  
  // Reset on unmount
  useEffect(() => {
    return () => {
      reset();
    };
  }, [reset]);
  
  // Track if we've already started creating a workflow
  const isCreatingRef = useRef(false);
  
  // Auto-create workflow when visiting /workflows/new
  const createWorkflowMutation = useMutation({
    mutationFn: () => workflowsApi.create({
      name: 'Untitled Workflow',
      description: '',
      versionTag: initialVersionTag,
      projectId: initialProjectId || undefined,
      nodes: [],
      edges: [],
    }),
    onSuccess: (data) => {
      console.log('[Workflow] Created new workflow:', data.id);
      // Use window.location for reliable redirect
      window.location.href = `/workflows/${data.id}`;
    },
    onError: (error) => {
      console.error('[Workflow] Failed to create workflow:', error);
      isCreatingRef.current = false; // Reset on error to allow retry
    },
  });
  
  // Auto-create when visiting /new
  useEffect(() => {
    if (isNew && !isCreatingRef.current) {
      console.log('[Workflow] Auto-creating new workflow...');
      isCreatingRef.current = true;
      createWorkflowMutation.mutate();
    }
  }, [isNew]);
  
  const handleSave = useCallback(() => {
    saveMutation.mutate();
  }, [saveMutation]);
  
  // Auto-save state
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>('');
  
  // Debug: Log when nodes/edges change
  useEffect(() => {
    console.log('[AutoSave Debug] nodes changed:', nodes.length, 'nodes');
  }, [nodes]);
  
  useEffect(() => {
    console.log('[AutoSave Debug] edges changed:', edges.length, 'edges');
  }, [edges]);
  
  // Auto-save effect - debounced save on changes
  useEffect(() => {
    console.log('[AutoSave] Effect running...', { id, nodesCount: nodes.length, edgesCount: edges.length, autoSaveEnabled });
    
    // Skip if auto-save is disabled
    if (!autoSaveEnabled) {
      console.log('[AutoSave] Skipping: auto-save disabled');
      return;
    }
    
    // Skip if no id or still on /new (will redirect soon)
    if (!id || id === 'new') {
      console.log('[AutoSave] Skipping: no valid id');
      return;
    }
    
    // Convert to simple format for saving
    const workflowNodes = nodes.map((n: WorkflowNode) => ({
      id: n.id,
      label: n.label,
      type: n.type,
      position: n.position,
      data: n.data,
    }));
    
    const workflowEdges = edges.map((e: WorkflowEdge) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      sourceHandle: e.sourceHandle,
      targetHandle: e.targetHandle,
    }));
    
    // Create a snapshot of current state
    const currentState = JSON.stringify({ nodes: workflowNodes, edges: workflowEdges });
    
    // Skip if nothing changed
    if (currentState === lastSavedRef.current) {
      console.log('[AutoSave] Skipping: no changes from last saved state');
      return;
    }
    
    console.log('[AutoSave] Changes detected, scheduling save in 1s...');
    
    // Clear previous timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    
    // Set timer for auto-save (1 second after last change)
    const timerId = setTimeout(async () => {
      console.log('[AutoSave] Timer fired! Calling API directly...');
      setAutoSaveStatus('saving');
      
      try {
        const result = await workflowsApi.patch(id, { nodes: workflowNodes, edges: workflowEdges });
        console.log('[AutoSave] API success:', result);
        lastSavedRef.current = currentState;
        setAutoSaveStatus('saved');
        clearUnsavedNodeIds();
        setTimeout(() => setAutoSaveStatus('idle'), 2000);
      } catch (error) {
        console.error('[AutoSave] API error:', error);
        setAutoSaveStatus('error');
      }
    }, 1000);
    
    autoSaveTimerRef.current = timerId;
    
    return () => {
      if (autoSaveTimerRef.current) {
        console.log('[AutoSave] Cleanup: clearing timer');
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [nodes, edges, id, clearUnsavedNodeIds]);
  
  // Update lastSavedRef when workflow is loaded
  useEffect(() => {
    if (workflowData) {
      lastSavedRef.current = JSON.stringify({ 
        nodes: workflowData.nodes || [], 
        edges: workflowData.edges || [] 
      });
    }
  }, [workflowData]);
  
  // Generate curl command
  const curlCommand = useMemo(() => {
    if (!workflow?.endpoint) return '';
    
    const baseUrl = window.location.origin.replace(':3000', ':8080');
    const url = `${baseUrl}${workflow.endpoint.path}`;
    
    let cmd = `curl -X ${testMethod} "${url}"`;
    
    // Add headers
    testHeaders.filter(h => h.enabled && h.key).forEach(h => {
      cmd += ` \\\n  -H "${h.key}: ${h.value}"`;
    });
    
    // Add body for POST/PUT
    if ((testMethod === 'POST' || testMethod === 'PUT') && testBody.trim()) {
      cmd += ` \\\n  -d '${testBody.replace(/'/g, "'\\''")}'`;
    }
    
    return cmd;
  }, [workflow?.endpoint, testMethod, testHeaders, testBody]);
  
  const handleCopyCurl = () => {
    navigator.clipboard.writeText(curlCommand);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2000);
  };
  
  const addHeader = () => {
    setTestHeaders([...testHeaders, { 
      id: Date.now().toString(), 
      key: '', 
      value: '', 
      enabled: true 
    }]);
  };
  
  const updateHeader = (id: string, field: 'key' | 'value' | 'enabled', value: string | boolean) => {
    setTestHeaders(testHeaders.map(h => 
      h.id === id ? { ...h, [field]: value } : h
    ));
  };
  
  const removeHeader = (id: string) => {
    setTestHeaders(testHeaders.filter(h => h.id !== id));
  };
  
  const handleTest = () => {
    try {
      const bodyData = testBody.trim() ? JSON.parse(testBody) : {};
      const headers: Record<string, string> = {};
      testHeaders.filter(h => h.enabled && h.key).forEach(h => {
        headers[h.key] = h.value;
      });
      testMutation.mutate({ ...bodyData, _headers: headers });
    } catch {
      alert('Invalid JSON body');
    }
  };
  
  // Show loading when:
  // 1. Creating a new workflow (on /new route)
  // 2. Loading an existing workflow
  const showLoading = createWorkflowMutation.isPending || (id !== 'new' && isLoadingWorkflow);
  
  if (showLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <Loader2 className="animate-spin text-gray-400 mx-auto mb-2" size={32} />
          <p className="text-gray-500">
            {createWorkflowMutation.isPending ? 'Creating workflow...' : 'Loading...'}
          </p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="h-screen flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft size={20} />
          </Link>
          
          <div>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!canEdit}
              className="text-lg font-semibold bg-transparent border-none focus:outline-none focus:ring-0 text-gray-900 dark:text-white disabled:cursor-not-allowed"
              placeholder="Workflow name"
            />
            <div className="flex items-center gap-2 text-sm text-gray-500">
              {workflow?.status && (
                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                  workflow.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {workflow.status}
                </span>
              )}
              {workflow?.endpoint && (
                <span className="font-mono text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded">
                  {workflow.endpoint.method} {workflow.endpoint.path}
                </span>
              )}
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {!isNew && workflow?.status === 'active' && canEdit ? (
            <button
              onClick={() => deactivateMutation.mutate()}
              disabled={deactivateMutation.isPending}
              className="px-3 py-2 text-sm text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/30 rounded-lg"
            >
              Deactivate
            </button>
          ) : !isNew && canEdit && (
            <button
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="px-3 py-2 text-sm text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 rounded-lg"
            >
              Activate
            </button>
          )}
          
          {!isNew && (
            <Link
              to={`/workflows/${id}/trace`}
              className="flex items-center gap-2 px-3 py-2 text-sm text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg"
            >
              <Activity size={16} />
              Trace Logs
            </Link>
          )}
          
          {!isNew && canExecute && (
            <button
              onClick={() => setShowTestPanel(true)}
              disabled={testMutation.isPending}
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              {testMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              Test
            </button>
          )}
          
          {canEdit && (
            <button
              onClick={() => setShowSettings(true)}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            >
              <Settings size={20} />
            </button>
          )}
          
          {/* Undo/Redo Buttons */}
          {canEdit && (
            <div className="flex items-center gap-1 border-l border-gray-200 dark:border-gray-600 pl-3 ml-1">
              <button
                onClick={undo}
                disabled={!canUndo()}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Undo (Ctrl+Z)"
              >
                <Undo2 size={20} />
              </button>
              <button
                onClick={redo}
                disabled={!canRedo()}
                className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg disabled:opacity-30 disabled:cursor-not-allowed"
                title="Redo (Ctrl+Y)"
              >
                <Redo2 size={20} />
              </button>
            </div>
          )}
          
          {/* Auto-save Status */}
          <div className="flex items-center gap-2 text-sm border-l border-gray-200 dark:border-gray-600 pl-3 ml-1">
            {autoSaveStatus === 'saving' && (
              <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                <Loader2 className="animate-spin" size={14} />
                Saving...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <Cloud size={14} />
                Saved
              </span>
            )}
            {autoSaveStatus === 'error' && (
              <span className="flex items-center gap-1 text-red-600 dark:text-red-400">
                <CloudOff size={14} />
                Error
              </span>
            )}
            {autoSaveStatus === 'idle' && !isNew && (
              <span className="flex items-center gap-1 text-gray-400 dark:text-gray-500">
                <Cloud size={14} />
              </span>
            )}
          </div>
          
          {canEdit && (
            <button
              onClick={handleSave}
              disabled={saveMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
              Save
            </button>
          )}
        </div>
      </header>
      
      {/* Canvas */}
      <div className="flex-1 relative">
        <FlowCanvas
          nodeTypes={nodeTypesData || []}
          schemas={[]}
          isLoadingNodeTypes={isLoadingNodeTypes}
          isLoadingSchemas={false}
        />
      </div>
      
      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg mx-4 p-6">
            <h2 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Workflow Settings</h2>
            
            <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-2">
              {/* Auto-Save Toggle */}
              <div className="flex items-center justify-between py-2">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Auto-Save</label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Automatically save changes after 1 second</p>
                </div>
                <button
                  type="button"
                  onClick={() => setAutoSaveEnabled(!autoSaveEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoSaveEnabled ? 'bg-blue-600' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoSaveEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              
              {/* Project Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Project <span className="text-red-500">*</span>
                </label>
                <select
                  value={selectedProjectId}
                  onChange={(e) => {
                    const newProjectId = e.target.value;
                    if (!newProjectId) return; // Don't allow unassigning
                    setSelectedProjectId(newProjectId);
                    // Auto-update version tag from project
                    const project = projectsData?.data?.find((p: Project) => p.id === newProjectId);
                    if (project) {
                      setVersionTag(project.versionTag);
                    }
                  }}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                  required
                >
                  {projectsData?.data?.map((project: Project) => (
                    <option key={project.id} value={project.id} className="dark:bg-gray-700 dark:text-white">
                      {project.name} ({project.versionTag})
                    </option>
                  ))}
                </select>
                
                {/* Project Info Display */}
                {selectedProject && (
                  <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Version:</span>
                      <code className="text-green-700 dark:text-green-400 font-mono">{selectedProject.versionTag}</code>
                    </div>
                    <div className="flex items-center gap-2 text-sm mt-1">
                      <span className="text-green-600 dark:text-green-400">✓</span>
                      <span className="text-gray-700 dark:text-gray-300">Path Prefix:</span>
                      <code className="text-green-700 dark:text-green-400 font-mono">{selectedProject.pathPrefix || `/api/${selectedProject.versionTag}`}</code>
                    </div>
                  </div>
                )}
              </div>
              
              <div className="border-t dark:border-gray-700 pt-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              
              {/* Endpoint Info - Read Only (configured in Trigger node) */}
              {triggerNodes.length > 0 && (
                <div className="border-t dark:border-gray-700 pt-4 mt-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Webhook Endpoints ({triggerNodes.length})
                  </label>
                  <div className="space-y-2">
                    {allEndpointPaths.map((endpoint) => (
                      <div key={endpoint.id} className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-1 text-xs font-medium rounded ${
                            endpoint.method === 'GET' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300' :
                            endpoint.method === 'POST' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' :
                            endpoint.method === 'PUT' ? 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300' :
                            endpoint.method === 'DELETE' ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' :
                            'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300'
                          }`}>
                            {endpoint.method}
                          </span>
                          <code className="text-sm text-gray-600 dark:text-gray-300 font-mono flex-1">{endpoint.path}</code>
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate">
                          {window.location.origin.replace(':3000', ':8602')}{endpoint.path}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                    Configure endpoints in Trigger node options. Add multiple Trigger nodes for multiple endpoints.
                  </p>
                </div>
              )}
            </div>
            
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t dark:border-gray-700">
              <button
                onClick={() => setShowSettings(false)}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleSave();
                  setShowSettings(false);
                }}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Test Panel Modal */}
      {showTestPanel && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            {/* Header */}
            <div className="px-6 py-4 border-b dark:border-gray-700 flex items-center justify-between bg-gradient-to-r from-green-50 dark:from-green-900/20 to-white dark:to-gray-800">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                  <Terminal size={20} className="text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Test Workflow</h2>
                  {workflow?.endpoint && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {workflow.endpoint.method} {workflow.endpoint.path}
                    </p>
                  )}
                </div>
              </div>
              <button 
                onClick={() => setShowTestPanel(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg text-gray-500 dark:text-gray-400"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {/* Method Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">HTTP Method</label>
                <div className="flex gap-2">
                  {(['GET', 'POST', 'PUT', 'DELETE'] as const).map((method) => (
                    <button
                      key={method}
                      onClick={() => setTestMethod(method)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                        testMethod === method
                          ? method === 'GET' ? 'bg-blue-600 text-white'
                          : method === 'POST' ? 'bg-green-600 text-white'
                          : method === 'PUT' ? 'bg-orange-600 text-white'
                          : 'bg-red-600 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {method}
                    </button>
                  ))}
                </div>
              </div>
              
              {/* Headers */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Headers</label>
                  <button
                    onClick={addHeader}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    <Plus size={14} />
                    Add Header
                  </button>
                </div>
                <div className="space-y-2">
                  {testHeaders.map((header) => (
                    <div key={header.id} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={header.enabled}
                        onChange={(e) => updateHeader(header.id, 'enabled', e.target.checked)}
                        className="w-4 h-4 rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                      />
                      <input
                        type="text"
                        value={header.key}
                        onChange={(e) => updateHeader(header.id, 'key', e.target.value)}
                        placeholder="Header name"
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm font-mono"
                      />
                      <input
                        type="text"
                        value={header.value}
                        onChange={(e) => updateHeader(header.id, 'value', e.target.value)}
                        placeholder="Value"
                        className="flex-1 px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm"
                      />
                      <button
                        onClick={() => removeHeader(header.id)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Body */}
              {(testMethod === 'POST' || testMethod === 'PUT') && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Request Body (JSON)</label>
                    <button
                      onClick={() => setTestBody(JSON.stringify({
                        user_email: "test@example.com",
                        first_name: "John",
                        last_name: "Doe",
                        custom_field: "value"
                      }, null, 2))}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Load Example
                    </button>
                  </div>
                  <textarea
                    value={testBody}
                    onChange={(e) => setTestBody(e.target.value)}
                    rows={8}
                    className="w-full px-4 py-3 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-mono text-sm resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder='{"key": "value"}'
                  />
                </div>
              )}
              
              {/* cURL Command */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    <Code size={16} />
                    cURL Command
                  </label>
                  <button
                    onClick={handleCopyCurl}
                    className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  >
                    {copiedCurl ? <Check size={14} /> : <Copy size={14} />}
                    {copiedCurl ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-sm font-mono overflow-x-auto whitespace-pre-wrap">
                  {curlCommand || 'Activate workflow to get endpoint'}
                </pre>
              </div>
              
              {/* Response */}
              {(testMutation.isSuccess || testMutation.isError) && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Response</label>
                  {testMutation.isSuccess ? (
                    <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Check size={16} className="text-green-600 dark:text-green-400" />
                        <span className="font-medium text-green-800 dark:text-green-300">Success</span>
                      </div>
                      <pre className="bg-green-100 dark:bg-green-900/40 p-3 rounded text-sm font-mono overflow-auto max-h-40 text-green-900 dark:text-green-200">
                        {JSON.stringify(testMutation.data?.data, null, 2)}
                      </pre>
                    </div>
                  ) : (
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <X size={16} className="text-red-600 dark:text-red-400" />
                        <span className="font-medium text-red-800 dark:text-red-300">Error</span>
                      </div>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {(testMutation.error as Error)?.message || 'An error occurred'}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Footer */}
            <div className="px-6 py-4 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex justify-between">
              <button
                onClick={() => testMutation.reset()}
                disabled={!testMutation.isSuccess && !testMutation.isError}
                className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg disabled:opacity-50"
              >
                Clear Response
              </button>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowTestPanel(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg"
                >
                  Close
                </button>
                <button
                  onClick={handleTest}
                  disabled={testMutation.isPending || !workflow?.endpoint}
                  className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
                >
                  {testMutation.isPending ? (
                    <Loader2 className="animate-spin" size={16} />
                  ) : (
                    <Play size={16} />
                  )}
                  Send Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
