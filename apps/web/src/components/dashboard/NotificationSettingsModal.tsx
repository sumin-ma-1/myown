import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";

interface NotificationSettingsModalProps {
  open: boolean;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

function offsetsEqual(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function parseOffsets(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0);
}

export function NotificationSettingsModal({
  open,
  onClose,
  onSaved,
}: NotificationSettingsModalProps) {
  const queryClient = useQueryClient();
  const [offsetDraft, setOffsetDraft] = useState("3,1,0");
  const [ddayEnabled, setDdayEnabled] = useState(true);
  const [briefingEnabled, setBriefingEnabled] = useState(true);
  const [briefingHour, setBriefingHour] = useState("8");
  const [briefingMinute, setBriefingMinute] = useState("0");

  const { data: settings } = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
  });

  const { data: integrations } = useQuery({
    queryKey: ["integrations"],
    queryFn: api.listIntegrations,
    enabled: open,
  });

  const telegramLinked = integrations?.items?.some(
    (item) => item.provider === "telegram" && item.status === "connected",
  );

  const offsets = settings?.notification.ddayOffsets ?? [3, 1, 0];
  const savedDdayEnabled = settings?.notification.ddayEnabled !== false;
  const reminderHour = settings?.notification.reminderHour ?? 9;
  const morningBriefing = settings?.notification.morningBriefing ?? {
    enabled: true,
    hour: 8,
    minute: 0,
  };

  useEffect(() => {
    if (!open) return;
    setOffsetDraft(offsets.join(","));
    setDdayEnabled(savedDdayEnabled);
    setBriefingEnabled(telegramLinked ? morningBriefing.enabled !== false : false);
    setBriefingHour(String(morningBriefing.hour));
    setBriefingMinute(String(morningBriefing.minute));
  }, [
    open,
    offsets,
    savedDdayEnabled,
    morningBriefing.enabled,
    morningBriefing.hour,
    morningBriefing.minute,
    telegramLinked,
  ]);

  const mutation = useMutation({
    mutationFn: (payload: {
      ddayEnabled: boolean;
      ddayOffsets: number[];
      morningBriefing: { enabled: boolean; hour: number; minute: number };
    }) =>
      api.updateSettings({
        notification: {
          ddayEnabled: payload.ddayEnabled,
          ddayOffsets: payload.ddayOffsets,
          reminderHour,
          morningBriefing: payload.morningBriefing,
        },
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
      onSaved?.("알림 설정이 저장되었습니다.");
      onClose();
    },
  });

  const handleSave = () => {
    const parsedOffsets = parseOffsets(offsetDraft);
    if (ddayEnabled && parsedOffsets.length === 0) return;

    const hour = Number(briefingHour);
    const minute = Number(briefingMinute);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) return;
    if (!Number.isInteger(minute) || minute < 0 || minute > 59) return;

    const offsetsToSave =
      parsedOffsets.length > 0 ? parsedOffsets : offsets;

    const nextBriefing = {
      enabled: telegramLinked ? briefingEnabled : false,
      hour,
      minute,
    };

    const unchanged =
      savedDdayEnabled === ddayEnabled &&
      offsetsEqual(offsetsToSave, offsets) &&
      (morningBriefing.enabled !== false) === nextBriefing.enabled &&
      morningBriefing.hour === hour &&
      morningBriefing.minute === minute;

    if (unchanged) {
      onClose();
      return;
    }

    mutation.mutate({
      ddayEnabled,
      ddayOffsets: offsetsToSave,
      morningBriefing: nextBriefing,
    });
  };

  return (
    <Modal open={open} title="알림 설정" onClose={onClose}>
      <section>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">D-DAY 알림</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              마감일이 있는 새 업무 등록 시에 자동으로 예약해요.
            </p>
          </div>
          <Switch
            checked={ddayEnabled}
            aria-label="D-DAY 알림"
            onCheckedChange={setDdayEnabled}
          />
        </div>

        {ddayEnabled && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-800/40">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              오프셋
            </label>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              예: 7,3,1,0 (0은 마감 당일)
            </p>
            <input
              className="mt-2 w-full rounded-lg border border-surface-border bg-white px-3 py-2 text-sm outline-none focus:border-brand dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={offsetDraft}
              onChange={(e) => setOffsetDraft(e.target.value)}
              placeholder="3,1,0"
            />
          </div>
        )}
      </section>

      <section className="mt-6 border-t border-slate-200 pt-5 dark:border-slate-700">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">아침 브리핑</h3>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              자동으로 오늘 마감 일정을 받아봐요.
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Switch
              checked={briefingEnabled}
              disabled={!telegramLinked}
              aria-label="아침 브리핑"
              onCheckedChange={setBriefingEnabled}
            />
            {!telegramLinked && (
              <p className="text-xs text-slate-500 dark:text-slate-400">Telegram 연결 필요</p>
            )}
          </div>
        </div>

        {briefingEnabled && (
          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/60 px-4 py-3 dark:border-slate-700/50 dark:bg-slate-800/40">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
              발송 시각
            </label>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">24시간 형식</p>
            <div className="mt-2 flex items-center gap-3">
              <div className="flex items-center">
                <input
                  type="number"
                  min={0}
                  max={23}
                  className="w-20 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={briefingHour}
                  disabled={!telegramLinked}
                  onChange={(e) => setBriefingHour(e.target.value)}
                />
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">시</span>
              </div>
              <div className="flex items-center">
                <input
                  type="number"
                  min={0}
                  max={59}
                  className="w-20 rounded-lg border border-surface-border bg-white px-3 py-2 text-sm outline-none focus:border-brand disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                  value={briefingMinute}
                  disabled={!telegramLinked}
                  onChange={(e) => setBriefingMinute(e.target.value)}
                />
                <span className="ml-2 text-sm text-slate-500 dark:text-slate-400">분</span>
              </div>
            </div>
          </div>
        )}
      </section>

      <div className="mt-6 flex justify-end gap-2">
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
          onClick={handleSave}
        >
          저장
        </button>
      </div>
    </Modal>
  );
}
