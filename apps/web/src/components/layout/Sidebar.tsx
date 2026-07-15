import { NavLink } from "react-router-dom";
import { IntegrationsPanel } from "@/components/integrations/IntegrationsPanel";
import { NotificationBell } from "@/components/notifications/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const navIconClass = "material-icons shrink-0 text-[18px] leading-none";

interface SidebarProps {
  expanded: boolean;
  width: number;
  resizing?: boolean;
  onToggle: () => void;
  onResizeStart: () => void;
}

function navLinkClass(expanded: boolean, isActive: boolean) {
  return `flex w-full items-center rounded-lg text-sm transition ${
    expanded ? "gap-1.5 px-3 py-2" : "justify-center px-2 py-2"
  } ${
    isActive
      ? "bg-brand-muted font-medium text-brand dark:bg-blue-950/60 dark:text-blue-300"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;
}

export function Sidebar({
  expanded,
  width,
  resizing = false,
  onToggle,
  onResizeStart,
}: SidebarProps) {
  const { me, isAdmin, logout } = useAuth();
  const { theme, setTheme } = useTheme();

  return (
    <aside
      style={{ width: expanded ? width : 56 }}
      className={`relative flex h-full shrink-0 flex-col overflow-hidden border-r border-surface-border bg-white dark:border-slate-800 dark:bg-slate-900 ${
        resizing ? "" : "transition-[width] duration-300 ease-in-out"
      }`}
    >
      <div
        className={`flex h-full min-h-0 flex-col ${expanded ? "p-4" : "items-center p-2"}`}
      >
        <div className={`shrink-0 ${expanded ? "mb-4" : "mb-4 flex w-full justify-center"}`}>
          {expanded ? (
            <div className="flex items-start justify-between gap-2">
              <NavLink
                to="/"
                end
                className="flex min-w-0 items-center gap-2 rounded-lg transition hover:opacity-80"
              >
                <img
                  src="/favicon.png"
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-lg"
                  width={32}
                  height={32}
                />
                <p className="text-lg font-bold text-slate-900 dark:text-slate-100">MyOwn</p>
              </NavLink>
              <div className="flex shrink-0 items-center gap-0.5">
                <NotificationBell />
                <button
                  type="button"
                  onClick={onToggle}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="사이드바 접기"
                >
                  <span className="material-icons text-[20px] leading-none" aria-hidden>
                    chevron_left
                  </span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex w-full flex-col items-center gap-2">
              <div className="group relative h-8 w-8 shrink-0">
                <img
                  src="/favicon.png"
                  alt="MyOwn"
                  className="h-8 w-8 rounded-lg transition-opacity group-hover:opacity-0"
                  width={32}
                  height={32}
                />
                <button
                  type="button"
                  onClick={onToggle}
                  className="absolute inset-0 flex items-center justify-center rounded-lg text-slate-600 opacity-0 transition-opacity hover:bg-slate-100 group-hover:opacity-100 dark:text-slate-300 dark:hover:bg-slate-800"
                  aria-label="사이드바 펼치기"
                >
                  <span className="material-icons text-[20px] leading-none" aria-hidden>
                    menu
                  </span>
                </button>
              </div>
              <NotificationBell compact />
            </div>
          )}
          {expanded && (
            <>
              <p className="mt-1 pl-10 text-xs text-slate-500 dark:text-slate-400">
                일정 · 업무 스마트 관리
              </p>
              {me?.account?.email && (
                <p className="mt-2 truncate pl-10 text-xs text-slate-400 dark:text-slate-500">
                  {me.account.email}
                </p>
              )}
            </>
          )}
        </div>

        <div
          className={`min-h-0 flex-1 overflow-y-auto scrollbar-subtle ${
            expanded ? "" : "w-full"
          }`}
        >
          <IntegrationsPanel compact={!expanded} />

          <nav className={`flex flex-col gap-1 ${expanded ? "" : "w-full"}`}>
            <NavLink to="/" end title={expanded ? undefined : "업무 현황"} className="block w-full">
              {({ isActive }) => (
                <span className={navLinkClass(expanded, isActive)}>
                  <span className={navIconClass} aria-hidden>
                    visibility
                  </span>
                  {expanded && "업무 현황"}
                </span>
              )}
            </NavLink>
            <NavLink to="/chat" title={expanded ? undefined : "마이온 챗"} className="block w-full">
              {({ isActive }) => (
                <span className={navLinkClass(expanded, isActive)}>
                  <span className={navIconClass} aria-hidden>
                    commit
                  </span>
                  {expanded && "마이온 챗"}
                </span>
              )}
            </NavLink>
            <NavLink to="/tasks" title={expanded ? undefined : "등록 업무 목록"} className="block w-full">
              {({ isActive }) => (
                <span className={navLinkClass(expanded, isActive)}>
                  <span className={navIconClass} aria-hidden>
                    menu_open
                  </span>
                  {expanded && "등록 업무 목록"}
                </span>
              )}
            </NavLink>
            <NavLink to="/integrations" title={expanded ? undefined : "연동 APP"} className="block w-full">
              {({ isActive }) => (
                <span className={navLinkClass(expanded, isActive)}>
                  <span className={navIconClass} aria-hidden>
                    link
                  </span>
                  {expanded && "연동 APP"}
                </span>
              )}
            </NavLink>
            {isAdmin && (
              <NavLink to="/admin" title={expanded ? undefined : "관리자"} className="block w-full">
                {({ isActive }) => (
                  <span className={navLinkClass(expanded, isActive)}>
                    <span className={navIconClass} aria-hidden>
                      bolt
                    </span>
                    {expanded && "관리자"}
                  </span>
                )}
              </NavLink>
            )}
          </nav>
        </div>

        <div className={`mt-3 w-full shrink-0 pt-2`}>
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            title={expanded ? undefined : theme === "dark" ? "라이트 모드" : "다크 모드"}
            className={`flex w-full items-center rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${
              expanded ? "gap-1.5 px-3 py-2" : "justify-center px-2 py-2"
            }`}
          >
            <span className="material-icons text-[18px] leading-none" aria-hidden>
              {theme === "dark" ? "light_mode" : "dark_mode"}
            </span>
            {expanded && (theme === "dark" ? "라이트 모드" : "다크 모드")}
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            title={expanded ? undefined : "로그아웃"}
            className={`mt-1 flex w-full items-center rounded-lg text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${
              expanded ? "gap-1.5 px-3 py-2" : "justify-center px-2 py-2"
            }`}
          >
            <span className="material-icons text-[18px] leading-none" aria-hidden>
              logout
            </span>
            {expanded && "로그아웃"}
          </button>
        </div>
      </div>

      {expanded && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="사이드바 너비 조절"
          title="드래그해서 너비 조절"
          className="absolute inset-y-0 right-0 z-10 w-1.5 cursor-col-resize touch-none hover:bg-brand/20 active:bg-brand/30"
          onPointerDown={(event) => {
            event.preventDefault();
            onResizeStart();
          }}
        />
      )}
    </aside>
  );
}
