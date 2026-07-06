import { NavLink, Outlet } from "react-router-dom";
import { useTheme } from "@/contexts/ThemeContext";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm transition ${
    isActive
      ? "bg-brand-muted font-medium text-brand dark:bg-blue-950/60 dark:text-blue-300"
      : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
  }`;

export function AdminLayout() {
  const { theme, setTheme } = useTheme();

  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-surface-border bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-6">
          <p className="text-lg font-bold text-slate-900 dark:text-slate-100">관리자</p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">베타 운영</p>
        </div>
        <nav className="flex flex-1 flex-col gap-1">
          <NavLink to="/admin/users" className={linkClass}>
            사용자
          </NavLink>
          <NavLink to="/admin/invites" className={linkClass}>
            초대코드
          </NavLink>
          <NavLink to="/admin/activity" className={linkClass}>
            로그인 기록
          </NavLink>
          <NavLink
            to="/"
            className="mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <span className="material-icons text-[18px] leading-none" aria-hidden>
              arrow_back
            </span>
            대시보드
          </NavLink>
        </nav>
        <button
          type="button"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          className="mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span className="material-icons text-[18px] leading-none" aria-hidden>
            {theme === "dark" ? "light_mode" : "dark_mode"}
          </span>
          {theme === "dark" ? "라이트 모드" : "다크 모드"}
        </button>
      </aside>
      <main className="flex-1 overflow-auto bg-gradient-to-br from-surface via-white to-brand-muted/40 p-6 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800/80">
        <Outlet />
      </main>
    </div>
  );
}
