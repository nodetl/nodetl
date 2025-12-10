import { Outlet } from 'react-router-dom';
import { Layout } from '@/components/Layout';

/**
 * LayoutRoute wraps children routes with the Layout component.
 * This ensures the navigation persists when switching between tabs.
 */
export function LayoutRoute() {
  return (
    <Layout>
      <Outlet />
    </Layout>
  );
}
