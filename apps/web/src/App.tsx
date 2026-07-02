import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdminRoute, GuestRoute, ProtectedRoute } from "@/components/auth/AuthRoutes";
import { AppShell } from "@/components/layout/AppShell";
import { AdminActivityPage } from "@/pages/admin/AdminActivityPage";
import { AdminInvitesPage } from "@/pages/admin/AdminInvitesPage";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminUsersPage } from "@/pages/admin/AdminUsersPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { IntegrationsPage } from "@/pages/IntegrationsPage";
import { LoginPage } from "@/pages/LoginPage";
import { SignupPage } from "@/pages/SignupPage";
import { TaskListPage } from "@/pages/TaskListPage";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppShell />}>
            <Route index element={<DashboardPage />} />
            <Route path="tasks" element={<TaskListPage />} />
            <Route path="integrations" element={<IntegrationsPage />} />
          </Route>
        </Route>

        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="users" replace />} />
            <Route path="users" element={<AdminUsersPage />} />
            <Route path="invites" element={<AdminInvitesPage />} />
            <Route path="activity" element={<AdminActivityPage />} />
          </Route>
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
