import type { ReactNode } from "react";

interface CardProps {
  id?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
  /** 반투명 글래스 + 그라데이션 테두리 */
  variant?: "default" | "glass";
}

export function Card({
  id,
  title,
  action,
  children,
  className = "",
  onClick,
  variant = "default",
}: CardProps) {
  const header =
    title || action ? (
      <header className="mb-3 flex min-w-0 items-center justify-between gap-2">
        {title ? (
          <h2 className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-slate-800 dark:text-slate-100">
            {title}
          </h2>
        ) : (
          <span />
        )}
        {action}
      </header>
    ) : null;

  if (variant === "glass") {
    return (
      <div
        id={id}
        onClick={onClick}
        className={`min-w-0 rounded-xl bg-gradient-to-br from-white/95 via-white/55 to-slate-200/55 p-px shadow-[0_10px_40px_-12px_rgba(15,23,42,0.12)] dark:from-white/45 dark:via-slate-300/20 dark:to-slate-500/35 dark:shadow-[0_12px_40px_-10px_rgba(0,0,0,0.55)] ${className}`}
      >
        <section
          className="h-full rounded-[11px] border border-white/70 bg-white/55 p-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.85),inset_0_-1px_0_0_rgba(148,163,184,0.12)] backdrop-blur-md dark:border-white/15 dark:bg-slate-900/45 dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.22),inset_0_-1px_0_0_rgba(255,255,255,0.05)] dark:backdrop-blur-xl"
        >
          {header}
          {children}
        </section>
      </div>
    );
  }

  return (
    <section
      id={id}
      onClick={onClick}
      className={`min-w-0 rounded-xl border border-surface-border bg-surface-card p-4 shadow-card dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-none ${className}`}
    >
      {header}
      {children}
    </section>
  );
}
