import { NavLink, Outlet } from "react-router-dom";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm transition ${
    isActive ? "bg-brand-muted font-medium text-brand" : "text-slate-600 hover:bg-slate-100"
  }`;

export function AdminLayout() {
  return (
    <div className="flex min-h-screen">
      <aside className="flex w-56 shrink-0 flex-col border-r border-surface-border bg-white p-4">
        <div className="mb-6">
          <p className="text-lg font-bold text-slate-900">관리자</p>
          <p className="mt-1 text-xs text-slate-500">베타 운영</p>
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
            className="mt-4 flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm text-slate-500 hover:bg-slate-100"
          >
            <span className="material-icons text-[18px] leading-none" aria-hidden>
              arrow_back
            </span>
            대시보드
          </NavLink>
        </nav>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
