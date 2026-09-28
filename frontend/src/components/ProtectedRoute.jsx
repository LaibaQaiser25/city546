import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { PageSpinner } from './ui/States';

/**
 * Frontend guard for admin pages. This is a UX convenience only —
 * the API independently rejects every admin request without a valid admin session.
 */
export default function ProtectedRoute() {
  const { status, isAdmin } = useAuth();
  const location = useLocation();

  if (status === 'loading') return <PageSpinner label="Checking your session…" />;
  if (!isAdmin) return <Navigate to="/admin/login" replace state={{ from: location }} />;
  return <Outlet />;
}
