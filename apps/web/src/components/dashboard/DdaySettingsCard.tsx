import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Card } from "@/components/ui/Card";

export function DdaySettingsCard() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("3,1,0");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

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
      setOpen(false);
    },
  });

  const offsets = settings?.notification.ddayOffsets ?? [3, 1, 0];

  return (
    <Card
      title="D-DAY 알림"
      action={
        <button
          type="button"
          className="rounded-lg bg-brand px-3 py-1 text-xs font-medium text-white"
          onClick={() => {
            setDraft(offsets.join(","));
            setOpen((v) => !v);
          }}
        >
          설정
        </button>
      }
    >
      <p className="text-sm text-slate-600">
        마감{" "}
        {offsets.map((d) => (d === 0 ? "당일" : `D-${d}`)).join(", ")} 알림
      </p>
      <p className="mt-1 text-xs text-slate-400">
        (저장된 설정 — 실제 스케줄러 연동은 다음 단계)
      </p>

      {open && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <label className="block text-xs font-medium text-slate-600">
            D-DAY 오프셋 (쉼표 구분, 예: 7,3,1,0)
          </label>
          <input
            className="mt-1 w-full rounded-md border border-surface-border px-2 py-1 text-sm"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              className="rounded-md bg-brand px-3 py-1 text-xs text-white"
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
            <button
              type="button"
              className="rounded-md border px-3 py-1 text-xs"
              onClick={() => setOpen(false)}
            >
              닫기
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}
