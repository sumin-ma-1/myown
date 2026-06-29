import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import { formatDateTime } from "@/lib/dates";

const PANEL_WIDTH = 224;

function ReminderPanel({ taskId }: { taskId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["reminders", taskId],
    queryFn: () => api.listReminders(taskId),
  });

  if (isLoading) return <p className="text-xs text-slate-500">불러오는 중…</p>;
  const items = data?.items ?? [];
  if (items.length === 0) {
    return <p className="text-xs text-slate-500">예약된 알림이 없습니다.</p>;
  }

  return (
    <ul className="max-h-40 space-y-1 overflow-auto text-xs">
      {items.map((r) => (
        <li key={r.id} className="flex justify-between gap-2 rounded bg-slate-50 px-2 py-1">
          <span>{formatDateTime(r.fireAt)}</span>
          <span
            className={
              r.status === "pending"
                ? "text-amber-600"
                : r.status === "sent"
                  ? "text-emerald-600"
                  : "text-slate-400"
            }
          >
            {r.status === "pending" ? "예약" : r.status === "sent" ? "발송" : "취소"}
          </span>
        </li>
      ))}
    </ul>
  );
}

interface ReminderBellProps {
  taskId: string;
  pendingCount: number;
}

export function ReminderBell({ taskId, pendingCount }: ReminderBellProps) {
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;

    const updatePosition = () => {
      const button = buttonRef.current;
      if (!button) return;

      const rect = button.getBoundingClientRect();
      const panelHeight = panelRef.current?.offsetHeight ?? 180;

      let left = rect.right - PANEL_WIDTH;
      left = Math.max(8, Math.min(left, window.innerWidth - PANEL_WIDTH - 8));

      let top = rect.bottom + 6;
      if (top + panelHeight > window.innerHeight - 8) {
        top = Math.max(8, rect.top - panelHeight - 6);
      }

      setPosition({ top, left });
    };

    updatePosition();
    const raf = requestAnimationFrame(updatePosition);

    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (buttonRef.current?.contains(target) || panelRef.current?.contains(target)) {
        return;
      }
      setOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="rounded-full p-1.5 hover:bg-slate-100"
        title="알림 로그"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        🔔
        {pendingCount > 0 && (
          <span className="ml-0.5 text-xs text-amber-600">{pendingCount}</span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            className="fixed z-50 rounded-lg border border-slate-200 bg-white p-3 text-left shadow-lg"
            style={{ top: position.top, left: position.left, width: PANEL_WIDTH }}
            role="dialog"
            aria-label="알림 예약 및 발송 내역"
          >
            <p className="mb-2 text-xs font-semibold text-slate-700">알림 예약/발송</p>
            <ReminderPanel taskId={taskId} />
          </div>,
          document.body,
        )}
    </>
  );
}
