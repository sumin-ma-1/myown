import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}

export function Card({ title, action, children, className = "" }: CardProps) {
  return (
    <section
      className={`rounded-xl border border-surface-border bg-surface-card p-4 shadow-card ${className}`}
    >
      {(title || action) && (
        <header className="mb-3 flex items-center justify-between gap-2">
          {title ? <h2 className="text-sm font-semibold text-slate-800">{title}</h2> : <span />}
          {action}
        </header>
      )}
      {children}
    </section>
  );
}
