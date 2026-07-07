import type { ReactNode } from "react";

export function CardTitle({
  icon,
  iconClassName,
  children,
}: {
  icon: string;
  iconClassName: string;
  children: ReactNode;
}) {
  return (
    <>
      <span
        className={`material-icons text-[18px] leading-none ${iconClassName}`}
        aria-hidden
      >
        {icon}
      </span>
      {children}
    </>
  );
}
