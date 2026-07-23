import { createPortal } from "react-dom";

interface ConfirmToastProps {
  open: boolean;
  message: string;
  icon?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** 화면 중앙 확인 토스트 (확인 / 취소) */
export function ConfirmToast({
  open,
  message,
  icon = "logout",
  confirmLabel = "확인",
  cancelLabel = "취소",
  onConfirm,
  onCancel,
}: ConfirmToastProps) {
  if (!open) return null;

  return createPortal(
    <div
      className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        role="alertdialog"
        aria-modal="true"
        aria-describedby="confirm-toast-message"
        className="pointer-events-auto flex max-w-sm flex-col gap-3 rounded-xl border border-slate-200/90 bg-white/95 px-5 py-4 shadow-xl backdrop-blur-sm [animation:toast-in_0.22s_ease-out] dark:border-slate-600/80 dark:bg-slate-800/95 dark:shadow-2xl"
      >
        <div className="flex items-start gap-2.5">
          <span
            className="material-icons mt-0.5 text-[22px] leading-none text-slate-500 dark:text-slate-400"
            aria-hidden
          >
            {icon}
          </span>
          <p
            id="confirm-toast-message"
            className="text-sm font-medium text-slate-800 dark:text-slate-100"
          >
            {message}
          </p>
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-medium text-white hover:bg-slate-800 dark:bg-cyan-950 dark:text-cyan-50 dark:hover:bg-cyan-900"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
