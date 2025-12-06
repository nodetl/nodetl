import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { executionsApi } from '@/api';
import { formatDate } from '@/lib/utils';
import type { NodeExecutionLog } from '@/types';

export default function ExecutionDetailPage() {
  const { id, executionId } = useParams<{ id: string; executionId: string }>();
  
  const { data, isLoading, error } = useQuery({
    queryKey: ['execution', executionId],
    queryFn: () => executionsApi.get(executionId!),
    refetchInterval: (query) => 
      query.state.data?.status === 'running' ? 2000 : false,
  });
  
  const execution = data;
  
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle2 className="text-green-500" size={20} />;
      case 'failed':
        return <XCircle className="text-red-500" size={20} />;
      case 'running':
        return <Loader2 className="text-blue-500 animate-spin" size={20} />;
      default:
        return <AlertCircle className="text-gray-400" size={20} />;
    }
  };
  
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      case 'running': return 'bg-blue-100 text-blue-800';
      default: return 'bg-gray-100 text-gray-600';
    }
  };
  
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="animate-spin text-gray-400" size={32} />
      </div>
    );
  }
  
  if (error || !execution) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            Failed to load execution details.
          </div>
        </div>
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/workflows/${id}`}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft size={20} />
            </Link>
            
            <div className="flex-1">
              <div className="flex items-center gap-3">
                {getStatusIcon(execution.status)}
                <h1 className="text-xl font-semibold text-gray-900">
                  Execution {execution.id.slice(0, 8)}
                </h1>
                <span className={`px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(execution.status)}`}>
                  {execution.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 mt-1">
                <Clock size={14} className="inline mr-1" />
                Started {formatDate(execution.startedAt)}
                {execution.completedAt && ` • Completed ${formatDate(execution.completedAt)}`}
              </p>
            </div>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Input Data</h2>
            <pre className="bg-gray-50 p-3 rounded-lg text-sm overflow-auto max-h-60 font-mono">
              {JSON.stringify(execution.input, null, 2)}
            </pre>
          </div>
          
          {/* Output */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h2 className="font-semibold text-gray-900 mb-3">Output Data</h2>
            <pre className="bg-gray-50 p-3 rounded-lg text-sm overflow-auto max-h-60 font-mono">
              {JSON.stringify(execution.output, null, 2)}
            </pre>
          </div>
        </div>
        
        {/* Error */}
        {execution.error && (
          <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
            <h2 className="font-semibold text-red-800 mb-2">Error</h2>
            <pre className="text-sm text-red-700 font-mono whitespace-pre-wrap">
              {execution.error.message}
            </pre>
          </div>
        )}
        
        {/* Node Logs */}
        <div className="mt-6 bg-white rounded-lg border border-gray-200">
          <div className="px-4 py-3 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Execution Trace</h2>
            <p className="text-sm text-gray-500">Node-by-node execution log</p>
          </div>
          
          <div className="divide-y divide-gray-100">
            {execution.nodeLogs?.map((log: NodeExecutionLog, index: number) => (
              <div key={index} className="p-4">
                <div className="flex items-start gap-3">
                  {getStatusIcon(log.status)}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-medium text-gray-900">{log.nodeId}</span>
                      <span className="text-xs text-gray-400">
                        {log.duration}ms
                      </span>
                    </div>
                    
                    {log.error && (
                      <p className="text-sm text-red-600 mb-2">{log.error}</p>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4 mt-2">
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Input</span>
                        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32 font-mono">
                          {JSON.stringify(log.input, null, 2)}
                        </pre>
                      </div>
                      <div>
                        <span className="text-xs text-gray-500 block mb-1">Output</span>
                        <pre className="text-xs bg-gray-50 p-2 rounded overflow-auto max-h-32 font-mono">
                          {JSON.stringify(log.output, null, 2)}
                        </pre>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {(!execution.nodeLogs || execution.nodeLogs.length === 0) && (
              <div className="p-8 text-center text-gray-500">
                No execution logs available
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
