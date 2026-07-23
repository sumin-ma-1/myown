import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { PAGE_BG_CLASS } from "@/lib/pageBackground";

const loadingClass = `flex min-h-screen items-center justify-center text-sm text-slate-500 dark:text-slate-400 ${PAGE_BG_CLASS}`;

export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className={loadingClass}>
        로딩 중…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }

  return <Outlet />;
}

export function AdminRoute() {
  const { isAdmin, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className={loadingClass}>
        로딩 중…
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (!isAdmin) {
    return <Navigate to="/chat" replace />;
  }

  return <Outlet />;
}

export function GuestRoute() {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className={loadingClass}>
        로딩 중…
      </div>
    );
  }

  if (isAuthenticated) {
    return <Navigate to="/chat" replace />;
  }

  return <Outlet />;
}
