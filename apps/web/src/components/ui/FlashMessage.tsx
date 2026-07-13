import { useEffect } from "react";
import { createPortal } from "react-dom";

interface FlashMessageProps {
  message: string | null;
  onDismiss?: () => void;
  /** 자동 숨김 (ms). 0이면 자동 숨김 없음 */
  autoHideMs?: number;
}

/** 화면 중앙에 잠깐 떴다 사라지는 안내 토스트 */
export function FlashMessage({ message, onDismiss, autoHideMs = 2200 }: FlashMessageProps) {
  useEffect(() => {
    if (!message || !onDismiss || autoHideMs <= 0) return;
    const timer = window.setTimeout(onDismiss, autoHideMs);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss, autoHideMs]);

  if (!message) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[60] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        role="status"
        aria-live="polite"
        className="pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-xl border border-emerald-200/90 bg-white/95 px-5 py-3.5 text-sm font-medium text-emerald-900 shadow-xl backdrop-blur-sm [animation:toast-in_0.22s_ease-out] dark:border-emerald-800/60 dark:bg-slate-800/95 dark:text-emerald-100 dark:shadow-2xl"
      >
        <span
          className="material-icons text-[22px] leading-none text-emerald-600 dark:text-emerald-400"
          aria-hidden
        >
          check_circle
        </span>
        <span>{message}</span>
      </div>
    </div>,
    document.body,
  );
}
