import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { ChatFab } from "./ChatFab";
import { Sidebar } from "./Sidebar";

const SIDEBAR_STORAGE_KEY = "myown.sidebar";
const SIDEBAR_DEFAULT_WIDTH = 224;
const SIDEBAR_MIN_WIDTH = 192;
const SIDEBAR_MAX_WIDTH = 420;

type SidebarPrefs = {
  expanded: boolean;
  width: number;
};

function clampSidebarWidth(width: number): number {
  return Math.min(SIDEBAR_MAX_WIDTH, Math.max(SIDEBAR_MIN_WIDTH, Math.round(width)));
}

function loadSidebarPrefs(): SidebarPrefs {
  try {
    const raw = localStorage.getItem(SIDEBAR_STORAGE_KEY);
    if (!raw) return { expanded: true, width: SIDEBAR_DEFAULT_WIDTH };
    const parsed = JSON.parse(raw) as Partial<SidebarPrefs>;
    return {
      expanded: parsed.expanded !== false,
      width: clampSidebarWidth(Number(parsed.width) || SIDEBAR_DEFAULT_WIDTH),
    };
  } catch {
    return { expanded: true, width: SIDEBAR_DEFAULT_WIDTH };
  }
}

export function AppShell() {
  const [prefs, setPrefs] = useState<SidebarPrefs>(() => loadSidebarPrefs());
  const [resizing, setResizing] = useState(false);

  useEffect(() => {
    localStorage.setItem(SIDEBAR_STORAGE_KEY, JSON.stringify(prefs));
  }, [prefs]);

  useEffect(() => {
    if (!resizing) return;
    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (event: PointerEvent) => {
      setPrefs((current) => ({
        ...current,
        expanded: true,
        width: clampSidebarWidth(event.clientX),
      }));
    };
    const onUp = () => setResizing(false);

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    return () => {
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };
  }, [resizing]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar
        expanded={prefs.expanded}
        width={prefs.width}
        resizing={resizing}
        onToggle={() =>
          setPrefs((current) => ({ ...current, expanded: !current.expanded }))
        }
        onResizeStart={() => setResizing(true)}
      />
      <main className="relative min-h-0 min-w-0 flex-1 overflow-auto p-6">
        <Outlet />
        <ChatFab />
      </main>
    </div>
  );
}
