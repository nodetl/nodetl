import { useParams, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { workflowsApi } from '@/api';
import TransformDetailPage from './TransformDetailPage';
import ResponseDetailPage from './ResponseDetailPage';
import ConditionDetailPage from './ConditionDetailPage';

// Unified node detail page that routes based on node type
export default function NodeDetailPage() {
  const { id: workflowId, nodeId } = useParams<{ id: string; nodeId: string }>();
  const [nodeType, setNodeType] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNodeType = async () => {
      if (!workflowId || !nodeId) {
        setLoading(false);
        return;
      }

      try {
        const workflow = await workflowsApi.get(workflowId);
        const node = workflow.nodes.find(n => n.id === nodeId);
        setNodeType(node?.type || null);
      } catch (error) {
        console.error('Failed to fetch workflow:', error);
        setNodeType(null);
      } finally {
        setLoading(false);
      }
    };

    fetchNodeType();
  }, [workflowId, nodeId]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="flex flex-col items-center gap-4">
          <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
          <span className="text-gray-600">Loading...</span>
        </div>
      </div>
    );
  }

  // Route to appropriate detail page based on node type
  switch (nodeType) {
    case 'transform':
      return <TransformDetailPage />;
    case 'response':
      return <ResponseDetailPage />;
    case 'condition':
      return <ConditionDetailPage />;
    default:
      // Unknown node type or not found - redirect back
      return <Navigate to={`/workflows/${workflowId}`} replace />;
  }
}
