import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuthStore, Permissions } from '@/stores/authStore';
import { Loader2 } from 'lucide-react';

export interface ProtectedRouteProps {
  children?: React.ReactNode;
  permission?: string;
  permissions?: string[];
  requireAll?: boolean;
}

export function ProtectedRoute({ 
  children, 
  permission, 
  permissions, 
  requireAll = false 
}: ProtectedRouteProps) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user, hasPermission, hasAnyPermission, hasAllPermissions } = useAuthStore();

  // Show loading state while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  // Redirect to change password if required
  if (user?.mustChangePassword) {
    return <Navigate to="/change-password" replace />;
  }

  // Check single permission
  if (permission && !hasPermission(permission)) {
    return <Navigate to="/403" replace />;
  }

  // Check multiple permissions
  if (permissions && permissions.length > 0) {
    const hasAccess = requireAll 
      ? hasAllPermissions(...permissions) 
      : hasAnyPermission(...permissions);
    
    if (!hasAccess) {
      return <Navigate to="/403" replace />;
    }
  }

  // Return children if provided, otherwise use Outlet for nested routes
  return children ? <>{children}</> : <Outlet />;
}

// Convenience wrapper for admin-only routes
export function AdminRoute({ children }: { children?: React.ReactNode }) {
  return (
    <ProtectedRoute permissions={[Permissions.USER_VIEW, Permissions.ROLE_VIEW]} requireAll={false}>
      {children}
    </ProtectedRoute>
  );
}

// Permission-based route component for specific resource/action checks
interface PermissionRouteProps {
  resource: string;
  action: string;
  children?: React.ReactNode;
}

export function PermissionRoute({ resource, action, children }: PermissionRouteProps) {
  const { isAuthenticated, isLoading, hasPermission } = useAuthStore();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!hasPermission(`${resource}:${action}`)) {
    return <Navigate to="/403" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}
