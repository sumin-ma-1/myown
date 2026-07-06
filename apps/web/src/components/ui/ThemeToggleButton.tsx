import { useTheme } from "@/contexts/ThemeContext";

export function ThemeToggleButton({ className = "" }: { className?: string }) {
  const { theme, setTheme } = useTheme();

  return (
    <button
      type="button"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
      className={`rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800 ${className}`}
      aria-label={theme === "dark" ? "라이트 모드" : "다크 모드"}
    >
      <span className="material-icons text-[20px] leading-none" aria-hidden>
        {theme === "dark" ? "light_mode" : "dark_mode"}
      </span>
    </button>
  );
}
