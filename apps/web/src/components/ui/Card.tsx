import type { ReactNode } from "react";

interface CardProps {
  id?: string;
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export function Card({ id, title, action, children, className = "", onClick }: CardProps) {
  return (
    <section
      id={id}
      onClick={onClick}
      className={`min-w-0 rounded-xl border border-surface-border bg-surface-card p-4 shadow-card dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-none ${className}`}
    >
      {(title || action) && (
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
      )}
      {children}
    </section>
  );
}
