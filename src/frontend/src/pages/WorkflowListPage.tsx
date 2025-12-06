import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { 
  Plus, Search, Play, Trash2, Loader2, Activity, 
  ChevronDown, ChevronRight, Copy, GripVertical, Edit2, 
  FolderKanban, ArrowUpDown, ChevronLeft
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workflowsApi, projectsApi } from '@/api';
import { cn, formatDate } from '@/lib/utils';
import { Layout } from '@/components/Layout';
import { useAuthStore } from '@/stores/authStore';
import type { Workflow, Project } from '@/types';

interface WorkflowListItem {
  id: string;
  name: string;
  description: string;
  status: string;
  versionTag: string;
  endpointPath?: string;
  endpointMethod?: string;
  updatedAt: string;
}

export default function WorkflowListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const hasPermission = useAuthStore((state) => state.hasPermission);
  const canDelete = hasPermission('workflows', 'delete');
  
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'updatedAt' | 'status'>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  const [collapsedVersions, setCollapsedVersions] = useState<Set<string>>(new Set());
  const [draggedWorkflow, setDraggedWorkflow] = useState<string | null>(null);
  const [dragOverVersion, setDragOverVersion] = useState<string | null>(null);
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
    mutationFn: async ({ id, versionTag }: { id: string; versionTag: string }) => 
      workflowsApi.update(id, { versionTag } as Partial<Workflow>),
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
  });
  
  const workflowItems: WorkflowListItem[] = useMemo(() => {
    return (workflowsData?.data || []).map(w => ({
      id: w.id, name: w.name, description: w.description || '', status: w.status,
      versionTag: (w as any).versionTag || '',
      endpointPath: w.endpoint?.path, endpointMethod: w.endpoint?.method, updatedAt: w.updatedAt,
    }));
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
      groups.push({ project: p, tag: p.versionTag, workflows: paginatedWorkflows.filter(w => w.versionTag === p.versionTag) });
    });
    const unversioned = paginatedWorkflows.filter(w => !w.versionTag || !projects.find(p => p.versionTag === w.versionTag));
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
  const handleDragOver = (e: React.DragEvent, tag: string) => { e.preventDefault(); setDragOverVersion(tag); };
  const handleDrop = (e: React.DragEvent, tag: string) => {
    e.preventDefault();
    if (draggedWorkflow) {
      const wf = workflowItems.find(w => w.id === draggedWorkflow);
      if (wf && wf.versionTag !== tag) {
        updateWorkflowVersionMutation.mutate({ id: draggedWorkflow, versionTag: tag === 'Unversioned' ? '' : tag });
      }
    }
    setDraggedWorkflow(null); setDragOverVersion(null);
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
    <Layout>
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
            <div key={project?.id || tag} className={cn("bg-white dark:bg-gray-800 rounded-lg border-2 overflow-hidden", dragOverVersion === tag ? "border-primary bg-primary/5" : "border-gray-200 dark:border-gray-700")}
              onDragOver={(e) => handleDragOver(e, tag)} onDragLeave={() => setDragOverVersion(null)} onDrop={(e) => handleDrop(e, tag)}>
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 dark:bg-gray-800/50 border-b border-gray-200 dark:border-gray-700">
                <button onClick={() => toggleVersion(tag)} className="flex items-center gap-3 hover:opacity-70">
                  {collapsedVersions.has(tag) ? <ChevronRight size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  <FolderKanban size={16} className="text-blue-500" />
                  {project && <span className="font-medium text-gray-900 dark:text-white">{project.name}</span>}
                  <span className={cn('px-2 py-0.5 text-sm font-medium rounded', getVersionColor(tag))}>{tag === 'Unversioned' ? 'Unversioned' : `v${tag}`}</span>
                  {project?.pathPrefix && <span className="text-xs text-gray-400 dark:text-gray-500 font-mono">{project.pathPrefix}</span>}
                  <span className="text-sm text-gray-500 dark:text-gray-400">({vwf.length})</span>
                </button>
                <div className="flex items-center gap-2">
                  {project && <>
                    <button onClick={() => createWorkflowInVersion(tag, project.id)} className="flex items-center gap-1 px-2 py-1 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"><Plus size={14} />Workflow</button>
                    <button onClick={() => openEditProject(project)} className="p-1.5 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded"><Edit2 size={14} /></button>
                    {vwf.length === 0 && <button onClick={() => confirm('Delete this project?') && deleteProjectMutation.mutate(project.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"><Trash2 size={14} /></button>}
                  </>}
                </div>
              </div>
              {!collapsedVersions.has(tag) && (
                <div className="divide-y divide-gray-100 dark:divide-gray-700">
                  {vwf.length === 0 ? <div className="px-4 py-6 text-center text-gray-400 dark:text-gray-500 text-sm">{project ? 'Drop workflows here or create new' : 'No unversioned'}</div> : vwf.map(wf => (
                    <div key={wf.id} draggable onDragStart={(e) => handleDragStart(e, wf.id)} onDragEnd={() => { setDraggedWorkflow(null); setDragOverVersion(null); }}
                      className={cn("px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700/50 cursor-grab", draggedWorkflow === wf.id && "opacity-50")}>
                      <div className="flex items-center gap-3">
                        <GripVertical size={16} className="text-gray-300 dark:text-gray-600" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-1">
                            <Link to={`/workflows/${wf.id}`} className="font-semibold text-gray-900 dark:text-white hover:text-primary truncate">{wf.name}</Link>
                            <span className={cn('px-2 py-0.5 text-xs rounded-full', getStatusColor(wf.status))}>{wf.status}</span>
                          </div>
                          <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-gray-500">
                            <span>{formatDate(wf.updatedAt)}</span>
                            {wf.endpointPath && <><span>•</span><span className="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded">{wf.endpointMethod} {wf.endpointPath}</span></>}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => cloneMutation.mutate({ id: wf.id })} className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg" title="Duplicate"><Copy size={16} /></button>
                          {wf.status === 'active' ? <button onClick={() => deactivateMutation.mutate(wf.id)} className="p-2 text-gray-400 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg" title="Deactivate"><Activity size={16} /></button>
                            : <button onClick={() => activateMutation.mutate(wf.id)} className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg" title="Activate"><Play size={16} /></button>}
                          {canDelete && <button onClick={() => confirm('Delete?') && deleteMutation.mutate(wf.id)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg" title="Delete"><Trash2 size={16} /></button>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
        
        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-6 px-2">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Page {currentPage} of {totalPages}
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg border transition-colors",
                  currentPage === 1
                    ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                First
              </button>
              <button
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors",
                  currentPage === 1
                    ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <ChevronLeft size={18} />
              </button>
              
              {/* Page numbers */}
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <button
                      key={pageNum}
                      onClick={() => setCurrentPage(pageNum)}
                      className={cn(
                        "w-8 h-8 text-sm rounded-lg transition-colors",
                        currentPage === pageNum
                          ? "bg-primary-600 text-white"
                          : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                      )}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>
              
              <button
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className={cn(
                  "p-1.5 rounded-lg border transition-colors",
                  currentPage === totalPages
                    ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                <ChevronRight size={18} />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className={cn(
                  "px-3 py-1.5 text-sm rounded-lg border transition-colors",
                  currentPage === totalPages
                    ? "border-gray-200 dark:border-gray-700 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                    : "border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                )}
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
      
      {showNewProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Create New Project</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name *</label>
                <input type="text" value={newProjectForm.name} onChange={(e) => setNewProjectForm(f => ({ ...f, name: e.target.value }))} placeholder="My Project" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={newProjectForm.description} onChange={(e) => setNewProjectForm(f => ({ ...f, description: e.target.value }))} rows={2} placeholder="Project description..." className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version Tag *</label>
                {existingTags.length > 0 && !useCustomTag ? (
                  <div className="space-y-2">
                    <select
                      value={newProjectForm.versionTag}
                      onChange={(e) => setNewProjectForm(f => ({ ...f, versionTag: e.target.value, pathPrefix: `/api/${e.target.value}` }))}
                      className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary"
                    >
                      <option value="">Select existing tag...</option>
                      {existingTags.map(tag => (
                        <option key={tag} value={tag}>v{tag}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setUseCustomTag(true)}
                      className="text-sm text-primary hover:underline"
                    >
                      + Create new tag
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <input type="text" value={newProjectForm.customTag} onChange={(e) => setNewProjectForm(f => ({ ...f, customTag: e.target.value, pathPrefix: `/api/${e.target.value}` }))} placeholder="1.0.0" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-mono focus:ring-2 focus:ring-primary" />
                    {existingTags.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setUseCustomTag(false); setNewProjectForm(f => ({ ...f, customTag: '' })); }}
                        className="text-sm text-primary hover:underline"
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
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => { setShowNewProject(false); setUseCustomTag(false); setNewProjectForm({ name: '', description: '', versionTag: '', customTag: '', pathPrefix: '/api/v1' }); }} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
              <button 
                onClick={createProject} 
                disabled={!newProjectForm.name.trim() || (existingTags.length > 0 && !useCustomTag ? !newProjectForm.versionTag : !newProjectForm.customTag.trim())} 
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
      
      {editingProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto py-8">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-md mx-4 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Edit Project: {editingProject.name}</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Project Name</label>
                <input type="text" value={editProjectForm.name} onChange={(e) => setEditProjectForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Description</label>
                <textarea value={editProjectForm.description} onChange={(e) => setEditProjectForm(f => ({ ...f, description: e.target.value }))} rows={3} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Version Tag</label>
                <input type="text" value={editProjectForm.versionTag} onChange={(e) => setEditProjectForm(f => ({ ...f, versionTag: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-mono focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Path Prefix</label>
                <input type="text" value={editProjectForm.pathPrefix} onChange={(e) => setEditProjectForm(f => ({ ...f, pathPrefix: e.target.value }))} placeholder="/api/v1" className="w-full px-3 py-2 border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg font-mono focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Route prefix for API endpoints</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button onClick={() => setEditingProject(null)} className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">Cancel</button>
              <button onClick={saveProject} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90">Save</button>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
