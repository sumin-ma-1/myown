import type { ReactNode } from "react";

export function CardTitle({
  icon,
  iconClassName,
  iconFontClass = "material-icons",
  children,
}: {
  icon: string;
  iconClassName: string;
  iconFontClass?: string;
  children: ReactNode;
}) {
  return (
    <>
      <span
        className={`${iconFontClass} text-[18px] leading-none ${iconClassName}`}
        aria-hidden
      >
        {icon}
      </span>
      {children}
    </>
  );
}
