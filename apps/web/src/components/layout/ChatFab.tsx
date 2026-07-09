import { Link, useLocation } from "react-router-dom";

const CHAT_FAB_PATHS = new Set(["/", "/tasks", "/integrations"]);

export function ChatFab() {
  const { pathname } = useLocation();

  if (!CHAT_FAB_PATHS.has(pathname)) return null;

  return (
    <Link
      to="/chat"
      className="chat-fab-float group fixed bottom-8 right-8 z-50 h-14 w-14 overflow-hidden rounded-full border border-slate-200/70 shadow-md transition-[border-color,box-shadow,opacity] duration-200 hover:border-brand/40 hover:shadow-lg dark:border-slate-600/70 dark:hover:border-blue-500/40"
      aria-label="마이온 챗"
      title="마이온 챗과 대화해보세요."
    >
      <img
        src="/bot-profile.png"
        alt=""
        className="h-full w-full object-cover opacity-40 transition-opacity duration-200 group-hover:opacity-100"
        width={56}
        height={56}
      />
    </Link>
  );
}
