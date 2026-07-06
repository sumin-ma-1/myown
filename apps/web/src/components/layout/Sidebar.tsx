import { NavLink } from "react-router-dom";
import { IntegrationsPanel } from "@/components/integrations/IntegrationsPanel";
import { useAuth } from "@/contexts/AuthContext";

const navIconClass = "material-icons shrink-0 text-[18px] leading-none";

interface SidebarProps {
  expanded: boolean;
  onToggle: () => void;
}

function navLinkClass(expanded: boolean, isActive: boolean) {
  return `flex items-center rounded-lg text-sm transition ${
    expanded ? "gap-1.5 px-3 py-2" : "justify-center px-2 py-2"
  } ${
    isActive ? "bg-brand-muted font-medium text-brand" : "text-slate-600 hover:bg-slate-100"
  }`;
}

export function Sidebar({ expanded, onToggle }: SidebarProps) {
  const { me, isAdmin, logout } = useAuth();

  return (
    <aside
      className={`flex shrink-0 flex-col overflow-hidden border-r border-surface-border bg-white transition-[width] duration-300 ease-in-out ${
        expanded ? "w-56" : "w-14"
      }`}
    >
      <div className={`flex h-full flex-col ${expanded ? "p-4" : "items-center p-2"}`}>
        <div className={`mb-6 ${expanded ? "" : "flex w-full justify-center"}`}>
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
                <p className="text-lg font-bold text-slate-900">MyOwn</p>
              </NavLink>
              <button
                type="button"
                onClick={onToggle}
                className="shrink-0 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label="사이드바 접기"
              >
                <span className="material-icons text-[20px] leading-none" aria-hidden>
                  chevron_left
                </span>
              </button>
            </div>
          ) : (
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
                className="absolute inset-0 flex items-center justify-center rounded-lg text-slate-600 opacity-0 transition-opacity hover:bg-slate-100 group-hover:opacity-100"
                aria-label="사이드바 펼치기"
              >
                <span className="material-icons text-[20px] leading-none" aria-hidden>
                  menu
                </span>
              </button>
            </div>
          )}
          {expanded && (
            <>
              <p className="mt-1 pl-10 text-xs text-slate-500">개인 업무 관리 플랫폼</p>
              {me?.account?.email && (
                <p className="mt-2 truncate pl-10 text-xs text-slate-400">{me.account.email}</p>
              )}
            </>
          )}
        </div>

        <IntegrationsPanel compact={!expanded} />

        <nav className={`flex flex-1 flex-col gap-1 ${expanded ? "" : "w-full"}`}>
          <NavLink to="/" end title={expanded ? undefined : "메인 화면"}>
            {({ isActive }) => (
              <span className={navLinkClass(expanded, isActive)}>
                <span className={navIconClass} aria-hidden>
                  home
                </span>
                {expanded && "메인 화면"}
              </span>
            )}
          </NavLink>
          <NavLink to="/tasks" title={expanded ? undefined : "등록 업무 목록"}>
            {({ isActive }) => (
              <span className={navLinkClass(expanded, isActive)}>
                <span className={navIconClass} aria-hidden>
                  sort
                </span>
                {expanded && "등록 업무 목록"}
              </span>
            )}
          </NavLink>
          <NavLink to="/integrations" title={expanded ? undefined : "연동 APP"}>
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
            <NavLink to="/admin" title={expanded ? undefined : "관리자"}>
              {({ isActive }) => (
                <span className={navLinkClass(expanded, isActive)}>
                  <span className={navIconClass} aria-hidden>
                    admin_panel_settings
                  </span>
                  {expanded && "관리자"}
                </span>
              )}
            </NavLink>
          )}
        </nav>

        <button
          type="button"
          onClick={() => void logout()}
          title={expanded ? undefined : "로그아웃"}
          className={`mt-4 flex items-center rounded-lg text-sm text-slate-500 hover:bg-slate-100 ${
            expanded ? "gap-1.5 px-3 py-2" : "justify-center px-2 py-2"
          }`}
        >
          <span className="material-icons text-[18px] leading-none" aria-hidden>
            logout
          </span>
          {expanded && "로그아웃"}
        </button>
      </div>
    </aside>
  );
}
