import { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded((value) => !value)}
      />
      <main className="min-h-screen min-w-0 flex-1 overflow-auto bg-gradient-to-br from-surface via-white to-brand-muted/40 p-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800/80">
        <Outlet />
      </main>
    </div>
  );
}
