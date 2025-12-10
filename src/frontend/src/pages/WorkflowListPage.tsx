import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Play, Trash2, Loader2, Activity, 
  ChevronDown, ChevronRight, Copy, GripVertical, Edit2, 
  FolderKanban, ArrowUpDown, Lock, Unlock, FileText
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi, projectsApi } from '@/api';
import { cn, formatDate } from '@/lib/utils';
import { Pagination } from '@/components/Pagination';
import { useAuthStore } from '@/stores/authStore';
import { useConfirm, useAlert, Dialog, DialogContent, DialogHeader, DialogTitle, DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { Workflow, Project } from '@/types';

interface WorkflowListItem {
  id: string;
  name: string;
  description: string;
  status: string;
  versionTag: string;
  projectId?: string;
  endpointPath?: string;
  endpointMethod?: string;
  hasWebhookTrigger: boolean;
  updatedAt: string;
}

export default function WorkflowListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canDelete = hasPermission('workflows', 'delete');
  const canLockProjects = hasPermission('projects', 'lock');
  const canDeleteProjects = hasPermission('projects', 'delete');
  
  const { confirm, ConfirmDialog } = useConfirm();
  const { alert, AlertDialog } = useAlert();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'updatedAt' | 'status'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  
  const [collapsedVersions, setCollapsedVersions] = useState<Set<string>>(new Set());
  const [draggedWorkflow, setDraggedWorkflow] = useState<string | null>(null);
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [editProjectForm, setEditProjectForm] = useState({
    name: '', description: '', versionTag: '', pathPrefix: '',
  });
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectForm, setNewProjectForm] = useState({ name: '', description: '', versionTag: '', customTag: '', pathPrefix: '/api/v1' });
  const [useCustomTag, setUseCustomTag] = useState(false);
  
  const { data: projectsData, isLoading: isLoadingProjects } = useQuery({
    queryKey: ['projects'], queryFn: () => projectsApi.list(1, 100),
  });
  
  const { data: workflowsData, isLoading: isLoadingWorkflows, error } = useQuery({
    queryKey: ['workflows'], queryFn: workflowsApi.list,
  });
  
  const projects = projectsData?.data || [];
  // Get unique version tags from projects
  const existingTags = useMemo(() => {
    const tags = new Set<string>();
    projects.forEach(p => p.versionTag && tags.add(p.versionTag));
    return Array.from(tags).sort();
  }, [projects]);
  
  const deleteMutation = useMutation({
    mutationFn: workflowsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to delete workflow';
      alert({
        title: 'Cannot Delete Workflow',
        description: message,
        variant: 'error',
      });
    },
  });
  
  const activateMutation = useMutation({
    mutationFn: workflowsApi.activate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });
  
  const deactivateMutation = useMutation({
    mutationFn: workflowsApi.deactivate,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });
  
  const updateWorkflowVersionMutation = useMutation({
    mutationFn: async ({ id, projectId, versionTag }: { id: string; projectId: string; versionTag: string }) => 
      workflowsApi.update(id, { projectId, versionTag } as Partial<Workflow>),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });
  
  const cloneMutation = useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      const wf = await workflowsApi.get(id);
      return workflowsApi.create({
        name: wf.name + ' (Copy)', description: wf.description, versionTag: wf.versionTag,
        nodes: wf.nodes, edges: wf.edges, endpoint: wf.endpoint, settings: wf.settings,
      } as Partial<Workflow>);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['workflows'] }),
  });
  
  const createProjectMutation = useMutation({
    mutationFn: projectsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setShowNewProject(false);
      setNewProjectForm({ name: '', description: '', versionTag: '', customTag: '', pathPrefix: '/api/v1' });
      setUseCustomTag(false);
    },
  });
  
  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Project> }) => projectsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      setEditingProject(null);
    },
  });
  
  const deleteProjectMutation = useMutation({
    mutationFn: projectsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
    onError: (error: any) => {
      const message = error.response?.data?.error || 'Failed to delete project';
      const details = error.response?.data?.details;
      if (details?.activeWorkflowCount) {
        alert({
          title: 'Cannot Delete Project',
          description: `${message}\n\nActive workflow: "${details.firstActiveWorkflow}"`,
          variant: 'error',
        });
      } else {
        alert({
          title: 'Delete Failed',
          description: message,
          variant: 'error',
        });
      }
    },
  });
  
  const toggleLockMutation = useMutation({
    mutationFn: ({ id, isLocked }: { id: string; isLocked: boolean }) => projectsApi.toggleLock(id, isLocked),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['projects'] }),
  });
  
  const workflowItems: WorkflowListItem[] = useMemo(() => {
    return (workflowsData?.data || []).map(w => {
      // Check if workflow has a webhook trigger node
      const triggerNode = w.nodes?.find(n => n.type === 'trigger');
      const hasWebhookTrigger = triggerNode?.data?.triggerType === 'webhook' || 
        (!triggerNode?.data?.triggerType && !!w.endpoint?.path); // Default to webhook if no triggerType but has endpoint
      
      return {
        id: w.id, name: w.name, description: w.description || '', 
        status: w.status || 'draft', // Default to 'draft' if status is empty
        versionTag: (w as any).versionTag || '',
        projectId: (w as any).projectId || '',
        endpointPath: w.endpoint?.path, endpointMethod: w.endpoint?.method,
        hasWebhookTrigger,
        updatedAt: w.updatedAt,
      };
    });
  }, [workflowsData]);
  
  const filteredWorkflows = useMemo(() => {
    let filtered = workflowItems.filter(w => 
      w.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.status.toLowerCase().includes(searchTerm.toLowerCase()) ||
      w.versionTag.toLowerCase().includes(searchTerm.toLowerCase())
    );
    
    // Sort
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortBy === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else {
        comparison = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [workflowItems, searchTerm, sortBy, sortOrder]);
  
  // Pagination
  const totalPages = Math.ceil(filteredWorkflows.length / pageSize);
  const paginatedWorkflows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredWorkflows.slice(start, start + pageSize);
  }, [filteredWorkflows, currentPage, pageSize]);
  
  const groupedWorkflows = useMemo(() => {
    const groups: { project: Project | null; tag: string; workflows: WorkflowListItem[] }[] = [];
    projects.forEach(p => {
      // Match by projectId instead of versionTag
      groups.push({ project: p, tag: p.versionTag, workflows: paginatedWorkflows.filter(w => w.projectId === p.id) });
    });
    // Unversioned: workflows without projectId or with non-matching projectId
    const unversioned = paginatedWorkflows.filter(w => !w.projectId || !projects.find(p => p.id === w.projectId));
    if (unversioned.length > 0 || projects.length === 0) {
      groups.push({ project: null, tag: 'Unversioned', workflows: unversioned });
    }
    return groups.filter(g => g.workflows.length > 0 || g.project); // Show empty projects too
  }, [projects, paginatedWorkflows]);
  
  const toggleSort = (field: 'name' | 'updatedAt' | 'status') => {
    if (sortBy === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('asc');
    }
  };
  
  const toggleVersion = (tag: string) => {
    setCollapsedVersions(prev => { const n = new Set(prev); n.has(tag) ? n.delete(tag) : n.add(tag); return n; });
  };
  
  const handleDragStart = (e: React.DragEvent, id: string) => { setDraggedWorkflow(id); e.dataTransfer.effectAllowed = 'move'; };
  const handleDragOver = (e: React.DragEvent, projectId: string) => { e.preventDefault(); setDragOverProjectId(projectId); };
  const handleDrop = async (e: React.DragEvent, project: Project | null) => {
    e.preventDefault();
    if (draggedWorkflow) {
      const wf = workflowItems.find(w => w.id === draggedWorkflow);
      const targetProjectId = project?.id || '';
      const targetVersionTag = project?.versionTag || '';
      
      // Check if workflow is active - cannot move active workflows
      if (wf && wf.status === 'active') {
        alert({
          title: 'Cannot Move Active Workflow',
          description: `"${wf.name}" is currently active. Please deactivate it before moving to another project.`,
          variant: 'warning',
        });
        setDraggedWorkflow(null);
        setDragOverProjectId(null);
        return;
      }
      
      // Only update if moving to different project
      if (wf && wf.projectId !== targetProjectId) {
        updateWorkflowVersionMutation.mutate({ 
          id: draggedWorkflow, 
          projectId: targetProjectId,
          versionTag: targetVersionTag 
        });
      }
    }
    setDraggedWorkflow(null); setDragOverProjectId(null);
  };
  
  const openEditProject = (p: Project) => {
    setEditingProject(p);
    setEditProjectForm({
      name: p.name || '', description: p.description || '', versionTag: p.versionTag || '', pathPrefix: p.pathPrefix || '',
    });
  };
  
  const saveProject = () => {
    if (!editingProject) return;
    updateProjectMutation.mutate({ id: editingProject.id, data: editProjectForm });
  };
  
  const createProject = () => {
    // If no existing tags OR user chose custom tag mode, use customTag; otherwise use selected versionTag
    const tag = (existingTags.length === 0 || useCustomTag) ? newProjectForm.customTag : newProjectForm.versionTag;
    if (!newProjectForm.name.trim() || !tag.trim()) return;
    createProjectMutation.mutate({
      name: newProjectForm.name,
      description: newProjectForm.description,
      versionTag: tag,
      pathPrefix: newProjectForm.pathPrefix || `/api/${tag}`,
    });
  };
  
  const createWorkflowInVersion = (tag: string, projectId?: string) => {
    const params = new URLSearchParams({ version: tag });
    if (projectId) params.set('projectId', projectId);
    navigate(`/workflows/new?${params.toString()}`);
  };
  
  const getStatusColor = (s: string) => {
    if (s === 'active') return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400';
    if (s === 'draft') return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  };
  
  const getVersionColor = (t: string) => {
    if (t === 'Unversioned') return 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
    const m = parseInt(t.split('.')[0] || '0');
    if (m >= 2) return 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400';
    if (m >= 1) return 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400';
    return 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400';
  };
  
  const isLoading = isLoadingProjects || isLoadingWorkflows;
  
  return (
    <>
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Data Mapping Workflows</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">Drag workflows between versions • Click edit to configure</p>
          </div>
          <button onClick={() => setShowNewProject(true)} className="flex items-center gap-2 px-4 py-2 bg-primary-600 dark:bg-primary-500 text-white rounded-lg hover:bg-primary-700 dark:hover:bg-primary-400">
            <Plus size={18} /> New Project
          </button>
        </div>

        {/* Search and Sort Controls */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" size={20} />
            <input 
              type="text" 
              value={searchTerm} 
              onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }} 
              placeholder="Search by name, description, status, version..." 
              className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent" 
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">Sort by:</span>
            <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-0.5">
              {(['name', 'updatedAt', 'status'] as const).map(field => (
                <button
                  key={field}
                  onClick={() => toggleSort(field)}
                  className={cn(
                    "px-3 py-1.5 text-sm rounded-md flex items-center gap-1 transition-colors",
                    sortBy === field 
                      ? "bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm" 
                      : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                  )}
                >
                  {field === 'updatedAt' ? 'Date' : field.charAt(0).toUpperCase() + field.slice(1)}
                  {sortBy === field && (
                    <ArrowUpDown size={14} className={sortOrder === 'desc' ? 'rotate-180' : ''} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        
        {/* Results info */}
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Showing {paginatedWorkflows.length} of {filteredWorkflows.length} workflows
            {searchTerm && ` matching "${searchTerm}"`}
          </p>
        </div>
        
        {isLoading && <div className="flex justify-center py-12"><Loader2 className="animate-spin text-gray-400 dark:text-gray-500" size={32} /></div>}
        {error && <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">Failed to load</div>}
        
        <div className="space-y-4">
          {groupedWorkflows.map(({ project, tag, workflows: vwf }) => (
            <div key={project?.id || tag} className={cn("bg-white dark:bg-gray-800 rounded-lg border-2 overflow-hidden", dragOverProjectId === (project?.id || 'unversioned') ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700")}
              onDragOver={(e) => handleDragOver(e, project?.id || 'unversioned')} onDragLeave={() => setDragOverProjectId(null)} onDrop={(e) => handleDrop(e, project)}>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <button onClick={() => toggleVersion(tag)} className="flex items-center gap-3 hover:opacity-70">
                  {collapsedVersions.has(tag) ? <ChevronRight size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  <FolderKanban size={16} className="text-blue-500" />
                  {project && <span className="font-medium text-gray-900 dark:text-white">{project.name}</span>}
                  {project?.isLocked && <span title="Project is locked"><Lock size={14} className="text-orange-500" /></span>}
                  <span className={cn('px-2 py-0.5 text-sm font-medium rounded', getVersionColor(tag))}>{tag === 'Unversioned' ? 'Unversioned' : `v${tag}`}</span>
                  {project?.pathPrefix && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{project.pathPrefix}</span>}
                  <span className="text-sm text-gray-500 dark:text-gray-400">({vwf.length})</span>
                </button>
                <div className="flex items-center gap-2">
                  {project && <>
                    <button onClick={() => createWorkflowInVersion(tag, project.id)} className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"><Plus size={14} />Workflow</button>
                    <Link to={`/projects/${project.id}/traces`} className="flex items-center gap-1 px-2 py-1 text-xs text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 rounded" title="View Traces"><FileText size={14} />Traces</Link>
                    <button onClick={() => openEditProject(project)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded" title="Edit"><Edit2 size={14} /></button>
                    {canLockProjects && (
                      <button 
                        onClick={() => toggleLockMutation.mutate({ id: project.id, isLocked: !project.isLocked })} 
                        className={cn(
                          "p-1.5 rounded",
                          project.isLocked 
                            ? "text-orange-500 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20" 
                            : "text-gray-400 hover:text-orange-500 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                        )} 
                        title={project.isLocked ? "Unlock project" : "Lock project"}
                      >
                        {project.isLocked ? <Lock size={14} /> : <Unlock size={14} />}
                      </button>
                    )}
                    {canDeleteProjects && !project.isLocked && (
                      <button 
                        onClick={async () => {
                          const ok = await confirm({
                            title: 'Delete Project',
                            description: 'Are you sure you want to delete this project? This action cannot be undone. Projects with active workflows cannot be deleted.',
                            variant: 'error',
                            confirmText: 'Delete',
                          });
                          if (ok) deleteProjectMutation.mutate(project.id);
                        }} 
                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded" 
                        title="Delete project"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </>}
                </div>
              </div>
              {!collapsedVersions.has(tag) && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {vwf.length === 0 ? <div className="px-4 py-6 text-center text-gray-400 dark:text-gray-500 text-sm">{project ? 'Drop workflows here or create new' : 'No unversioned'}</div> : vwf.map(wf => {
                    const isActive = wf.status === 'active';
                    return (
                    <div 
                      key={wf.id} 
                      draggable={!isActive}
                      onDragStart={(e) => !isActive && handleDragStart(e, wf.id)} 
                      onDragEnd={() => { setDraggedWorkflow(null); setDragOverProjectId(null); }}
                      className={cn(
                        "px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50", 
                        isActive ? "cursor-default" : "cursor-grab",
                        draggedWorkflow === wf.id && "opacity-50"
                      )}
                      title={isActive ? "Deactivate workflow before moving" : undefined}
                    >
                      <div className="flex items-center gap-3">
                        <GripVertical size={16} className={cn(isActive ? "text-gray-200 dark:text-gray-700" : "text-gray-300 dark:text-gray-600")} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <Link to={`/workflows/${wf.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-primary truncate">{wf.name}</Link>
                            <span className={cn('px-2 py-0.5 text-xs rounded-full', getStatusColor(wf.status))}>{wf.status}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                            <span>{formatDate(wf.updatedAt)}</span>
                            {wf.hasWebhookTrigger && wf.endpointPath && <><span>•</span><span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{wf.endpointMethod} {wf.endpointPath}</span></>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => cloneMutation.mutate({ id: wf.id })} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg" title="Duplicate"><Copy size={16} /></button>
                          {wf.status === 'active' ? <button onClick={() => deactivateMutation.mutate(wf.id)} className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg" title="Deactivate"><Activity size={16} /></button>
                            : <button onClick={() => activateMutation.mutate(wf.id)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Activate"><Play size={16} /></button>}
                          {canDelete && !isActive && (
                            <button 
                              onClick={async () => {
                                const ok = await confirm({
                                  title: 'Delete Workflow',
                                  description: `Are you sure you want to delete "${wf.name}"? This action cannot be undone.`,
                                  variant: 'error',
                                  confirmText: 'Delete',
                                });
                                if (ok) deleteMutation.mutate(wf.id);
                              }} 
                              className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" 
                              title="Delete"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )})}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Pagination */}
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filteredWorkflows.length}
          pageSize={pageSize}
          onPageChange={(page) => setCurrentPage(page)}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
        />
      </div>
      
      {/* Confirm and Alert Dialogs */}
      <ConfirmDialog />
      <AlertDialog />
      
      {/* New Project Dialog */}
      <Dialog open={showNewProject} onOpenChange={setShowNewProject}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Project</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name *</label>
              <input type="text" value={newProjectForm.name} onChange={(e) => setNewProjectForm(f => ({ ...f, name: e.target.value }))} placeholder="My Project" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea value={newProjectForm.description} onChange={(e) => setNewProjectForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Project description..." className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version Tag *</label>
              {existingTags.length > 0 && !useCustomTag ? (
                <div className="space-y-2">
                  <select
                    value={newProjectForm.versionTag}
                    onChange={(e) => setNewProjectForm(f => ({ ...f, versionTag: e.target.value, pathPrefix: `/api/${e.target.value}` }))}
                    className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary"
                  >
                    <option value="">Select existing tag...</option>
                    {existingTags.map(tag => (
                      <option key={tag} value={tag}>v{tag}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => setUseCustomTag(true)}
                    className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                  >
                    + Create new tag
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <input type="text" value={newProjectForm.customTag} onChange={(e) => setNewProjectForm(f => ({ ...f, customTag: e.target.value, pathPrefix: `/api/${e.target.value}` }))} placeholder="1.0.0" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-mono focus:ring-2 focus:ring-primary focus:border-primary" />
                  {existingTags.length > 0 && (
                    <button
                      type="button"
                      onClick={() => { setUseCustomTag(false); setNewProjectForm(f => ({ ...f, customTag: '' })); }}
                      className="text-sm text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      ← Select from existing tags
                    </button>
                  )}
                </div>
              )}
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Use semantic versioning (e.g., 1.0.0, 2.0.0)</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Path Prefix (auto-generated)</label>
              <div className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-mono">
                {newProjectForm.pathPrefix || '/api/[version]'}
              </div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Route prefix for API endpoints (based on version tag)</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setShowNewProject(false); setUseCustomTag(false); setNewProjectForm({ name: '', description: '', versionTag: '', customTag: '', pathPrefix: '/api/v1' }); }}>
              Cancel
            </Button>
            <Button 
              onClick={createProject} 
              disabled={!newProjectForm.name.trim() || (existingTags.length > 0 && !useCustomTag ? !newProjectForm.versionTag : !newProjectForm.customTag.trim())} 
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Edit Project Dialog */}
      <Dialog open={!!editingProject} onOpenChange={(open) => !open && setEditingProject(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Project: {editingProject?.name}</DialogTitle>
          </DialogHeader>
          <DialogBody className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name</label>
              <input type="text" value={editProjectForm.name} onChange={(e) => setEditProjectForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
              <textarea value={editProjectForm.description} onChange={(e) => setEditProjectForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version Tag</label>
              <input type="text" value={editProjectForm.versionTag} onChange={(e) => setEditProjectForm(f => ({ ...f, versionTag: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-mono focus:ring-2 focus:ring-primary focus:border-primary" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Path Prefix</label>
              <input type="text" value={editProjectForm.pathPrefix} onChange={(e) => setEditProjectForm(f => ({ ...f, pathPrefix: e.target.value }))} placeholder="/api/v1" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-mono focus:ring-2 focus:ring-primary focus:border-primary" />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Route prefix for API endpoints</p>
            </div>
          </DialogBody>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingProject(null)}>
              Cancel
            </Button>
            <Button onClick={saveProject}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
