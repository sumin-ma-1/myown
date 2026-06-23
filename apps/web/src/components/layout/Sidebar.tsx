import { NavLink } from "react-router-dom";
import { IntegrationsPanel } from "@/components/integrations/IntegrationsPanel";

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `block rounded-lg px-3 py-2 text-sm transition ${
    isActive ? "bg-brand-muted font-medium text-brand" : "text-slate-600 hover:bg-slate-100"
  }`;

export function Sidebar() {
  return (
    <aside className="flex w-56 shrink-0 flex-col border-r border-surface-border bg-white p-4">
      <div className="mb-6">
        <div className="flex items-center gap-2">
          <img
            src="/favicon.png"
            alt=""
            className="h-8 w-8 shrink-0 rounded-lg"
            width={32}
            height={32}
          />
          <p className="text-lg font-bold text-slate-900">My Own</p>
        </div>
        <p className="mt-1 pl-10 text-xs text-slate-500">개인 업무 대시보드</p>
      </div>

      <IntegrationsPanel />

      <nav className="flex flex-1 flex-col gap-1">
        <NavLink to="/" end className={linkClass}>
          메인 화면
        </NavLink>
        <NavLink to="/tasks" className={linkClass}>
          등록 업무 목록
        </NavLink>
      </nav>
    </aside>
  );
}
