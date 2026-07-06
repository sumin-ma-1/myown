import type { ReactNode } from "react";

interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, action, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-surface-border bg-surface-card p-4 shadow-card dark:border-slate-700 dark:bg-slate-800/80 dark:shadow-none ${className}`}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title ? (
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-100">{title}</h2>
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
