import { NavLink } from "react-router-dom";

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

      <div className="mb-6">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          연동 APP
        </p>
        <ul className="space-y-1 text-sm text-slate-700">
          <li className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
            <span>Telegram</span>
            <span className="text-xs text-emerald-600">연결됨</span>
          </li>
          <li className="flex items-center justify-between rounded-lg px-3 py-2 text-slate-400">
            <span>KakaoTalk</span>
            <span className="text-xs">예정</span>
          </li>
        </ul>
      </div>

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
