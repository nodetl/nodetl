import { useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowLeft,
  Loader2,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCw,
  ChevronRight,
  Search,
  Filter,
  Webhook,
  Timer,
  MousePointer,
  Activity,
  Calendar,
  Zap,
  Copy,
  ExternalLink,
  ArrowUpDown,
  FolderKanban,
} from 'lucide-react';
import { executionsApi, projectsApi } from '@/api';
import { formatDate, cn } from '@/lib/utils';
import { Pagination } from '@/components/Pagination';
import type { Execution, NodeExecutionLog, ExecutionStatus } from '@/types';

// Status configurations
const STATUS_CONFIG: Record<ExecutionStatus, { icon: React.ReactNode; color: string; bg: string; darkBg: string }> = {
  completed: { 
    icon: <CheckCircle2 size={16} />, 
    color: 'text-green-600 dark:text-green-400', 
    bg: 'bg-green-100',
    darkBg: 'dark:bg-green-900/30'
  },
  failed: { 
    icon: <XCircle size={16} />, 
    color: 'text-red-600 dark:text-red-400', 
    bg: 'bg-red-100',
    darkBg: 'dark:bg-red-900/30'
  },
  running: { 
    icon: <Loader2 size={16} className="animate-spin" />, 
    color: 'text-blue-600 dark:text-blue-400', 
    bg: 'bg-blue-100',
    darkBg: 'dark:bg-blue-900/30'
  },
  pending: { 
    icon: <Clock size={16} />, 
    color: 'text-yellow-600 dark:text-yellow-400', 
    bg: 'bg-yellow-100',
    darkBg: 'dark:bg-yellow-900/30'
  },
  cancelled: { 
    icon: <AlertCircle size={16} />, 
    color: 'text-gray-600 dark:text-gray-400', 
    bg: 'bg-gray-100',
    darkBg: 'dark:bg-gray-800'
  },
};

const TRIGGER_ICONS: Record<string, React.ReactNode> = {
  webhook: <Webhook size={14} />,
  schedule: <Timer size={14} />,
  manual: <MousePointer size={14} />,
};

// Node Execution Log Item
function NodeLogItem({ log }: { log: NodeExecutionLog }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const status = STATUS_CONFIG[log.status];

  return (
    <div 
      className={cn(
        "border rounded-lg overflow-hidden transition-all",
        log.status === 'failed' ? 'border-red-200 dark:border-red-800' : 'border-gray-200 dark:border-gray-700'
      )}
    >
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
      >
        <div className={cn("p-1.5 rounded-full", status.bg, status.darkBg, status.color)}>
          {status.icon}
        </div>
        
        <div className="flex-1 text-left">
          <div className="flex items-center gap-2">
            <span className="font-medium text-sm dark:text-white">{log.nodeLabel || log.nodeId}</span>
            <span className="text-xs text-gray-400 dark:text-gray-500 px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 rounded">
              {log.nodeType}
            </span>
          </div>
          {log.error && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 truncate max-w-md">{log.error}</p>
          )}
        </div>
        
        <span className="text-xs text-gray-500 dark:text-gray-400 font-mono">
          {log.duration}ms
        </span>
        
        <ChevronRight 
          size={16} 
          className={cn(
            "text-gray-400 dark:text-gray-500 transition-transform",
            isExpanded && "rotate-90"
          )} 
        />
      </button>
      
      {isExpanded && (
        <div className="px-4 py-3 border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
          {/* Timestamps */}
          <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
            <span>Started: {formatDate(log.startedAt)}</span>
            {log.completedAt && <span>Completed: {formatDate(log.completedAt)}</span>}
          </div>
          
          {/* Input/Output */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Input</span>
                <button 
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(log.input, null, 2))}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Copy size={12} />
                </button>
              </div>
              <pre className="text-xs bg-gray-900 text-green-400 p-2 rounded overflow-auto max-h-40 font-mono">
                {JSON.stringify(log.input, null, 2)}
              </pre>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-medium text-gray-600 dark:text-gray-300">Output</span>
                <button 
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(log.output, null, 2))}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <Copy size={12} />
                </button>
              </div>
              <pre className="text-xs bg-gray-900 text-blue-400 p-2 rounded overflow-auto max-h-40 font-mono">
                {JSON.stringify(log.output, null, 2)}
              </pre>
            </div>
          </div>
          
          {/* Error details */}
          {log.error && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <span className="text-xs font-medium text-red-700 dark:text-red-400 block mb-1">Error</span>
              <pre className="text-xs text-red-600 dark:text-red-400 font-mono whitespace-pre-wrap">{log.error}</pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Execution Card
function ExecutionCard({ 
  execution, 
  isSelected,
  onClick 
}: { 
  execution: Execution; 
  isSelected: boolean;
  onClick: () => void;
}) {
  const status = STATUS_CONFIG[execution.status];
  
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full text-left px-4 py-3 border-b dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors",
        isSelected && "bg-blue-50 dark:bg-blue-900/30 border-l-2 border-l-blue-500"
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("p-1.5 rounded-full mt-0.5", status.bg, status.darkBg, status.color)}>
          {status.icon}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {execution.workflowName || 'Workflow'}
            </span>
            <span className={cn("px-1.5 py-0.5 rounded text-xs", status.bg, status.darkBg, status.color)}>
              {execution.status}
            </span>
          </div>
          
          <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
            <span className="font-mono text-gray-400 dark:text-gray-500">
              {execution.id.slice(0, 8)}...
            </span>
            <span className="flex items-center gap-1">
              {TRIGGER_ICONS[execution.triggerType] || <Zap size={12} />}
              {execution.triggerType}
            </span>
            <span className="flex items-center gap-1">
              <Clock size={12} />
              {execution.duration}ms
            </span>
          </div>
          
          <div className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500 mt-1">
            <Calendar size={12} />
            {formatDate(execution.startedAt)}
          </div>
          
          {execution.error && (
            <p className="text-xs text-red-500 dark:text-red-400 mt-1 truncate">{execution.error.message}</p>
          )}
        </div>
      </div>
    </button>
  );
}

export default function ProjectTracesPage() {
  const { id } = useParams<{ id: string }>();
  
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ExecutionStatus | 'all'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'date' | 'duration'>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // Fetch project
  const { data: project } = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsApi.get(id!),
    enabled: !!id,
  });

  // Fetch executions for project
  const { data: executionsData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['project-executions', id, currentPage, pageSize],
    queryFn: () => executionsApi.listByProject(id!, currentPage, pageSize),
    enabled: !!id,
    refetchInterval: 5000, // Auto-refresh every 5 seconds
  });

  const executions = executionsData?.data || [];
  const totalExecutions = executionsData?.total || 0;
  const totalPages = executionsData?.totalPages || 1;
  
  // Filter and sort executions
  const filteredExecutions = useMemo(() => {
    let filtered = executions.filter(e => {
      if (statusFilter !== 'all' && e.status !== statusFilter) return false;
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesId = e.id.toLowerCase().includes(query);
        const matchesWorkflow = (e.workflowName || '').toLowerCase().includes(query);
        if (!matchesId && !matchesWorkflow) return false;
      }
      return true;
    });
    
    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === 'date') {
        comparison = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
      } else {
        comparison = a.duration - b.duration;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    
    return filtered;
  }, [executions, statusFilter, searchQuery, sortBy, sortOrder]);

  // Selected execution
  const selectedExecution = executions.find(e => e.id === selectedExecutionId);

  // Auto-select first execution when data loads
  useState(() => {
    if (filteredExecutions.length > 0 && !selectedExecutionId) {
      setSelectedExecutionId(filteredExecutions[0].id);
    }
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gray-100 dark:bg-gray-900">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-4 py-3 flex items-center justify-between shadow-sm flex-shrink-0">
        <div className="flex items-center gap-4">
          <Link 
            to="/workflows" 
            className="p-2 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft size={20} />
          </Link>
          <div>
            <h1 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
              <FolderKanban size={20} className="text-purple-600 dark:text-purple-400" />
              Project Traces
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {project?.name || 'Project'} • {totalExecutions} executions
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-2 px-3 py-2 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <RefreshCw size={16} className={isFetching ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Executions List */}
        <div className="w-96 bg-white dark:bg-gray-800 border-r dark:border-gray-700 flex flex-col flex-shrink-0">
          {/* Filters */}
          <div className="p-3 border-b dark:border-gray-700 space-y-2">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by ID or workflow name..."
                className="w-full pl-9 pr-3 py-2 border dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm"
              />
            </div>
            
            <div className="flex items-center gap-1">
              <Filter size={14} className="text-gray-400" />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ExecutionStatus | 'all')}
                className="flex-1 px-2 py-1.5 border dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs"
              >
                <option value="all" className="dark:bg-gray-700">All Status</option>
                <option value="completed" className="dark:bg-gray-700">Completed</option>
                <option value="failed" className="dark:bg-gray-700">Failed</option>
                <option value="running" className="dark:bg-gray-700">Running</option>
                <option value="pending" className="dark:bg-gray-700">Pending</option>
              </select>
            </div>
            
            <div className="flex items-center gap-1">
              <ArrowUpDown size={14} className="text-gray-400" />
              <select
                value={`${sortBy}-${sortOrder}`}
                onChange={(e) => {
                  const [field, order] = e.target.value.split('-') as ['date' | 'duration', 'asc' | 'desc'];
                  setSortBy(field);
                  setSortOrder(order);
                }}
                className="flex-1 px-2 py-1.5 border dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-xs"
              >
                <option value="date-desc" className="dark:bg-gray-700">Newest First</option>
                <option value="date-asc" className="dark:bg-gray-700">Oldest First</option>
                <option value="duration-desc" className="dark:bg-gray-700">Slowest First</option>
                <option value="duration-asc" className="dark:bg-gray-700">Fastest First</option>
              </select>
            </div>
          </div>
          
          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {filteredExecutions.length === 0 ? (
              <div className="p-8 text-center text-gray-500 dark:text-gray-400">
                <Activity size={32} className="mx-auto mb-2 opacity-30" />
                <p className="font-medium">No executions</p>
                <p className="text-sm">Run workflows in this project to see traces</p>
              </div>
            ) : (
              filteredExecutions.map((execution) => (
                <ExecutionCard
                  key={execution.id}
                  execution={execution}
                  isSelected={execution.id === selectedExecutionId}
                  onClick={() => setSelectedExecutionId(execution.id)}
                />
              ))
            )}
          </div>

          {/* Pagination */}
          <div className="border-t dark:border-gray-700 p-2">
            <Pagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={totalExecutions}
              pageSize={pageSize}
              onPageChange={setCurrentPage}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              compact
            />
          </div>
        </div>

        {/* Execution Detail */}
        <div className="flex-1 flex flex-col overflow-hidden bg-gray-100 dark:bg-gray-900">
          {selectedExecution ? (
            <>
              {/* Execution Header */}
              <div className="bg-white dark:bg-gray-800 border-b dark:border-gray-700 px-6 py-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        STATUS_CONFIG[selectedExecution.status].bg,
                        STATUS_CONFIG[selectedExecution.status].darkBg,
                        STATUS_CONFIG[selectedExecution.status].color
                      )}>
                        {STATUS_CONFIG[selectedExecution.status].icon}
                      </div>
                      <div>
                        <h2 className="font-semibold text-gray-900 dark:text-white">
                          {selectedExecution.workflowName || 'Execution'} - {selectedExecution.id.slice(0, 8)}
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Triggered by {selectedExecution.triggerType} • {selectedExecution.duration}ms
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigator.clipboard.writeText(selectedExecution.id)}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="Copy Execution ID"
                    >
                      <Copy size={16} />
                    </button>
                    <Link
                      to={`/workflows/${selectedExecution.workflowId}/trace`}
                      className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
                      title="View Workflow Traces"
                    >
                      <ExternalLink size={16} />
                    </Link>
                  </div>
                </div>
              </div>

              {/* Execution Content */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Timeline */}
                <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
                  <div className="px-4 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <h3 className="font-semibold text-gray-900 dark:text-white">Execution Timeline</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedExecution.nodeLogs?.length || 0} nodes executed
                    </p>
                  </div>
                  
                  <div className="p-4 space-y-2">
                    {selectedExecution.nodeLogs && selectedExecution.nodeLogs.length > 0 ? (
                      selectedExecution.nodeLogs.map((log, index) => (
                        <NodeLogItem key={index} log={log} />
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                        <Activity size={24} className="mx-auto mb-2 opacity-30" />
                        <p>No node execution logs</p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Input & Output */}
                <div className="grid grid-cols-2 gap-6">
                  <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Input</h3>
                      <button
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedExecution.input, null, 2))}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <pre className="p-4 text-sm overflow-auto max-h-60 font-mono bg-gray-900 text-green-400">
                      {JSON.stringify(selectedExecution.input, null, 2)}
                    </pre>
                  </div>
                  
                  <div className="bg-white dark:bg-gray-800 rounded-xl border dark:border-gray-700 shadow-sm overflow-hidden">
                    <div className="px-4 py-3 border-b dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex items-center justify-between">
                      <h3 className="font-semibold text-gray-900 dark:text-white">Output</h3>
                      <button
                        onClick={() => navigator.clipboard.writeText(JSON.stringify(selectedExecution.output, null, 2))}
                        className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        <Copy size={14} />
                      </button>
                    </div>
                    <pre className="p-4 text-sm overflow-auto max-h-60 font-mono bg-gray-900 text-blue-400">
                      {JSON.stringify(selectedExecution.output, null, 2)}
                    </pre>
                  </div>
                </div>

                {/* Error (if any) */}
                {selectedExecution.error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4">
                    <h3 className="font-semibold text-red-800 dark:text-red-400 mb-2">Error</h3>
                    <pre className="text-sm text-red-700 dark:text-red-400 font-mono whitespace-pre-wrap">
                      {selectedExecution.error.message}
                    </pre>
                    {selectedExecution.error.stack && (
                      <pre className="text-xs text-red-500 dark:text-red-500 font-mono mt-2 opacity-75">
                        {selectedExecution.error.stack}
                      </pre>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-gray-500 dark:text-gray-400">
              <div className="text-center">
                <Activity size={48} className="mx-auto mb-4 opacity-30" />
                <p className="font-medium">Select an execution</p>
                <p className="text-sm">to view trace details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
