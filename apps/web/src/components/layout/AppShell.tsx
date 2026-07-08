import { useState } from "react";
import { Outlet } from "react-router-dom";
import { ChatFab } from "./ChatFab";
import { Sidebar } from "./Sidebar";

export function AppShell() {
  const [sidebarExpanded, setSidebarExpanded] = useState(true);

  return (
    <div className="flex min-h-screen">
      <Sidebar
        expanded={sidebarExpanded}
        onToggle={() => setSidebarExpanded((value) => !value)}
      />
      <main className="relative min-h-screen min-w-0 flex-1 overflow-auto p-6">
        <Outlet />
        <ChatFab />
      </main>
    </div>
  );
}
