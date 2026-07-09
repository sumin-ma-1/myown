declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: {
          start_param?: string;
        };
        ready?: () => void;
        expand?: () => void;
        openLink?: (url: string, options?: { try_browser?: boolean }) => void;
        close?: () => void;
      };
    };
  }
}

const EXTERNAL_INTENT_KEY = "myown_tg_external";
const EXTERNAL_INTENT_TTL_MS = 60_000;

export type TelegramGateMode = "prompt" | "app";

/** 텔레그램 미니앱 WebView (initData 있음) */
export function isTelegramWebApp(): boolean {
  return Boolean(window.Telegram?.WebApp?.initData?.trim());
}

export function markExternalBrowserIntent(): void {
  try {
    localStorage.setItem(EXTERNAL_INTENT_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

function hasExternalBrowserIntent(): boolean {
  try {
    const raw = localStorage.getItem(EXTERNAL_INTENT_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at) || Date.now() - at > EXTERNAL_INTENT_TTL_MS) {
      localStorage.removeItem(EXTERNAL_INTENT_KEY);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export function consumeExternalBrowserIntent(): boolean {
  if (!hasExternalBrowserIntent()) return false;
  try {
    localStorage.removeItem(EXTERNAL_INTENT_KEY);
  } catch {
    // ignore
  }
  return true;
}

/** 외부 브라우저로 열기를 방금 선택한 경우 */
export function isExternalBrowserSession(): boolean {
  return hasExternalBrowserIntent();
}

/**
 * 미니앱 첫 진입에서만 안내 표시.
 * 외부 열기 의도가 있으면 무조건 앱 화면.
 */
export function resolveTelegramGateMode(): TelegramGateMode {
  if (isExternalBrowserSession()) return "app";
  if (isTelegramWebApp()) return "prompt";
  return "app";
}

export function getTelegramStartParam(): string | undefined {
  const param = window.Telegram?.WebApp?.initDataUnsafe?.start_param?.trim();
  return param || undefined;
}

export function initTelegramWebApp(): void {
  const webApp = window.Telegram?.WebApp;
  webApp?.ready?.();
  webApp?.expand?.();
}

/** 외부 브라우저에 넘길 URL — 쿼리·경로 없이 origin( https://… )만 */
export function externalBrowserUrl(): string {
  return window.location.origin;
}

/** 사용자 탭(클릭) 안에서 호출해야 텔레그램이 외부 브라우저를 연다. */
export function openInExternalBrowser(url: string): void {
  const webApp = window.Telegram?.WebApp;

  if (webApp?.openLink) {
    webApp.openLink(url, { try_browser: true });
    return;
  }

  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (!opened) {
    window.location.assign(url);
  }
}

export function openCurrentPageInExternalBrowser(): void {
  markExternalBrowserIntent();
  openInExternalBrowser(externalBrowserUrl());
}
