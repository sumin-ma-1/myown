export type Theme = "light" | "dark";

export const THEME_STORAGE_KEY = "myown-theme";

export function getPreferredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // private mode 등
  }
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyTheme(theme: Theme) {
  const root = document.documentElement;
  if (theme === "dark") {
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
  }
}

export function storeTheme(theme: Theme) {
  localStorage.setItem(THEME_STORAGE_KEY, theme);
}
