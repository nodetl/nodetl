import { Routes, Route, Navigate } from 'react-router-dom';
import { ReactFlowProvider } from 'reactflow';

import { WorkflowListPage, WorkflowEditorPage, ExecutionDetailPage, NodeDetailPage, TraceLogsPage } from '@/pages';
import { LoginPage } from '@/pages/LoginPage';
import { InviteAcceptPage } from '@/pages/InviteAcceptPage';
import { AuthCallbackPage } from '@/pages/AuthCallbackPage';
import { ForbiddenPage } from '@/pages/ForbiddenPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { UsersPage } from '@/pages/UsersPage';
import { RolesPage } from '@/pages/RolesPage';
import { InvitationsPage } from '@/pages/InvitationsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import ProjectsPage from '@/pages/ProjectsPage';
import { ForceChangePasswordPage } from '@/pages/ForceChangePasswordPage';
import { ProtectedRoute, PermissionRoute } from '@/components/ProtectedRoute';
import { ThemeProvider } from '@/components/ThemeProvider';
import { useAuthStore } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

// Home page component - shows login if not authenticated, workflows if authenticated
function HomePage() {
  const { isAuthenticated, isLoading, user } = useAuthStore();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  // Redirect to force change password if required
  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  return <WorkflowListPage />;
}

function App() {
  return (
    <ThemeProvider>
      <ReactFlowProvider>
        <Routes>
          {/* Home - Login or Workflows based on auth state */}
          <Route path="/" element={<HomePage />} />
          
          {/* Public routes */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/invite/accept" element={<InviteAcceptPage />} />
          <Route path="/auth/callback/:provider" element={<AuthCallbackPage />} />
          <Route path="/403" element={<ForbiddenPage />} />
          <Route path="/change-password" element={<ForceChangePasswordPage />} />

          {/* Protected routes - require authentication */}
          <Route element={<ProtectedRoute />}>
            <Route path="/workflows" element={<WorkflowListPage />} />
            <Route path="/workflows/:id" element={<WorkflowEditorPage />} />
            <Route path="/workflows/:id/trace" element={<TraceLogsPage />} />
            <Route path="/workflows/:id/executions/:executionId" element={<ExecutionDetailPage />} />
            <Route path="/workflows/:id/n/:nodeId" element={<NodeDetailPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/projects" element={<ProjectsPage />} />
          </Route>

          {/* Admin routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<PermissionRoute resource="users" action="view" />}>
              <Route path="/admin/users" element={<UsersPage />} />
            </Route>
            <Route element={<PermissionRoute resource="roles" action="view" />}>
              <Route path="/admin/roles" element={<RolesPage />} />
            </Route>
            <Route element={<PermissionRoute resource="invitations" action="view" />}>
              <Route path="/admin/invitations" element={<InvitationsPage />} />
            </Route>
            <Route element={<PermissionRoute resource="settings" action="view" />}>
              <Route path="/admin/settings" element={<SettingsPage />} />
            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ReactFlowProvider>
    </ThemeProvider>
  );
}

export default App;
