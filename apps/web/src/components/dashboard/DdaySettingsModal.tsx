import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Modal } from "@/components/ui/Modal";

interface DdaySettingsModalProps {
  open: boolean;
  onClose: () => void;
}

export function DdaySettingsModal({ open, onClose }: DdaySettingsModalProps) {
  const queryClient = useQueryClient();
  const [draft, setDraft] = useState("3,1,0");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const offsets = settings?.notification.ddayOffsets ?? [3, 1, 0];

  useEffect(() => {
    if (!open) return;
    setDraft(offsets.join(","));
  }, [open, settings?.notification.ddayOffsets]);

  const mutation = useMutation({
    mutationFn: (ddayOffsets: number[]) =>
      api.updateSettings({
        notification: {
          ddayOffsets,
          reminderHour: settings?.notification.reminderHour ?? 9,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      onClose();
    },
  });

  return (
    <Modal open={open} title="D-DAY 알림 설정" onClose={onClose}>
      <p className="text-sm text-slate-600 dark:text-slate-300">
        마감일이 있는 새 업무 등록 시에 자동으로 예약되는 알림입니다.
      </p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        현재: 마감{" "}
        <span className="font-medium text-slate-800 dark:text-slate-100">
          {offsets.map((d) => (d === 0 ? "당일" : `D-${d}`)).join(", ")}
        </span>
      </p>

      <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
        D-DAY 오프셋 (쉼표 구분)
      </label>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">예: 7,3,1,0 (0은 마감 당일)</p>
      <input
        className="mt-2 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm outline-none focus:border-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="3,1,0"
      />

      <div className="mt-5 flex justify-end gap-2">
        <button
          type="button"
          className="rounded-lg border border-surface-border px-4 py-2 text-sm text-slate-600 dark:border-slate-600 dark:text-slate-300"
          onClick={onClose}
        >
          취소
        </button>
        <button
          type="button"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          disabled={mutation.isPending}
          onClick={() => {
            const parsed = draft
              .split(",")
              .map((s) => Number(s.trim()))
              .filter((n) => Number.isInteger(n) && n >= 0);
            if (parsed.length > 0) mutation.mutate(parsed);
          }}
        >
          저장
        </button>
      </div>
    </Modal>
  );
}
