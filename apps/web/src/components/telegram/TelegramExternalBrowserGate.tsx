import { useEffect, useState, type ReactNode } from "react";
import {
  consumeExternalBrowserIntent,
  initTelegramWebApp,
  isExternalBrowserSession,
  openCurrentPageInExternalBrowser,
  resolveTelegramGateMode,
  type TelegramGateMode,
} from "@/lib/telegram-webapp";

function TelegramOpenInBrowserPrompt() {
  useEffect(() => {
    initTelegramWebApp();
  }, []);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6 dark:bg-slate-950">
      <div className="w-full max-w-sm rounded-2xl border border-surface-border bg-white p-6 text-center shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <img src="/favicon.png" alt="" className="mx-auto mb-4 h-12 w-12 rounded-xl" />
        <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
          MyOwn
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">
          The easiest way to add your work schedule and get reminders.
        </p>
        <button
          type="button"
          onClick={openCurrentPageInExternalBrowser}
          className="mt-5 w-full rounded-3xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
        >
          외부 브라우저에서 열기
        </button>
      </div>
    </div>
  );
}

export function TelegramExternalBrowserGate({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<TelegramGateMode | null>(null);

  useEffect(() => {
    initTelegramWebApp();

    const apply = () => {
      if (isExternalBrowserSession()) {
        consumeExternalBrowserIntent();
        setMode("app");
        return;
      }
      setMode(resolveTelegramGateMode());
    };

    apply();

    const frame = requestAnimationFrame(apply);
    return () => cancelAnimationFrame(frame);
  }, []);

  if (mode === null) {
    return <div className="min-h-screen bg-slate-50 dark:bg-slate-950" />;
  }

  if (mode === "prompt") {
    return <TelegramOpenInBrowserPrompt />;
  }

  return children;
}
