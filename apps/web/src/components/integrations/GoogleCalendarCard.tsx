import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { CalendarImportDto } from "@/api/types";
import { IntegrationTitle } from "@/components/integrations/IntegrationIcon";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/dates";

function statusLabel(connected: boolean): string {
  return connected ? "연결됨" : "미연결";
}

function statusClass(connected: boolean): string {
  return connected
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

export function GoogleCalendarCard() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pastDays, setPastDays] = useState(7);
  const [futureDays, setFutureDays] = useState(90);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const status = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: api.getGoogleCalendarStatus,
  });

  const imports = useQuery({
    queryKey: ["google-calendar-imports"],
    queryFn: () => api.listGoogleCalendarImports(),
    enabled: Boolean(status.data?.connected),
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const gcalError = params.get("gcal_error");
    const gcalConnected = params.get("gcal_connected");
    if (gcalError) {
      setError(decodeURIComponent(gcalError));
      params.delete("gcal_error");
      window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
    }
    if (gcalConnected) {
      setMessage("Google Calendar가 연결되었습니다. 일정 가져오기를 눌러 주세요.");
      params.delete("gcal_connected");
      window.history.replaceState({}, "", `${window.location.pathname}?${params}`);
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
    }
  }, [queryClient]);

  const sync = useMutation({
    mutationFn: () => api.syncGoogleCalendar({ pastDays, futureDays }),
    onSuccess: (data) => {
      setError(null);
      setMessage(`가져오기 완료 (신규 ${data.imported}건, 갱신 ${data.updated}건)`);
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-imports"] });
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (err) => {
      setMessage(null);
      setError(err instanceof Error ? err.message : "동기화에 실패했습니다.");
    },
  });

  const disconnect = useMutation({
    mutationFn: api.disconnectGoogleCalendar,
    onSuccess: () => {
      setMessage(null);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-imports"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "연결 해제에 실패했습니다.");
    },
  });

  const setEnabled = useMutation({
    mutationFn: ({ id, enabled }: { id: string; enabled: boolean }) =>
      api.setGoogleCalendarImport(id, enabled),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-imports"] });
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "변경에 실패했습니다.");
    },
  });

  const batchSetEnabled = useMutation({
    mutationFn: ({ ids, enabled }: { ids: string[]; enabled: boolean }) =>
      api.batchSetGoogleCalendarImports(ids, enabled),
    onSuccess: () => {
      setError(null);
      setSelected(new Set());
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-imports"] });
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      void queryClient.invalidateQueries({ queryKey: ["tasks"] });
      void queryClient.invalidateQueries({ queryKey: ["calendar"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "일괄 변경에 실패했습니다.");
    },
  });

  const items = imports.data?.items ?? [];
  const connected = Boolean(status.data?.connected);
  const available = status.data?.available !== false;
  const selectedIds = useMemo(() => [...selected], [selected]);
  const allSelected = items.length > 0 && items.every((item) => selected.has(item.id));
  const batchPending = setEnabled.isPending || batchSetEnabled.isPending;

  const toggleSelectAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(items.map((item) => item.id)));
  };

  const toggleRowSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectByEnabled = (enabled: boolean) => {
    setSelected(new Set(items.filter((item) => item.enabled === enabled).map((item) => item.id)));
  };

  const toggleEnabled = (item: CalendarImportDto) => {
    setEnabled.mutate({ id: item.id, enabled: !item.enabled });
  };

  if (!available) {
    return (
      <Card title={<IntegrationTitle id="google-calendar" name="Google Calendar" />}>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Google OAuth가 설정되지 않아 Calendar 연동을 사용할 수 없습니다.
        </p>
      </Card>
    );
  }

  return (
    <Card title={<IntegrationTitle id="google-calendar" name="Google Calendar" />}>
      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Google Calendar 일정을 가져온 뒤, 원하는 항목만 MyOwn 업무로 활성화합니다.
          </p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(connected)}`}
          >
            {statusLabel(connected)}
          </span>
        </div>

        {connected && status.data?.googleEmail && (
          <p className="text-xs text-slate-500 dark:text-slate-400">연결 계정: {status.data.googleEmail}</p>
        )}

        <div className="flex flex-wrap gap-2">
          {!connected ? (
            <a
              href="/api/integrations/google-calendar/connect"
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90"
            >
              Google Calendar 연결
            </a>
          ) : (
            <>
              <div className="flex flex-wrap items-end gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-300">과거 (일)</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    className="block w-20 rounded-lg border border-surface-border bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={pastDays}
                    onChange={(e) => setPastDays(Number(e.target.value))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-300">앞으로 (일)</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="block w-20 rounded-lg border border-surface-border bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={futureDays}
                    onChange={(e) => setFutureDays(Number(e.target.value))}
                  />
                </label>
              </div>
              <button
                type="button"
                className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
                disabled={sync.isPending}
                onClick={() => sync.mutate()}
              >
                {sync.isPending ? "가져오는 중…" : "일정 가져오기"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                disabled={disconnect.isPending}
                onClick={() => disconnect.mutate()}
              >
                연결 해제
              </button>
            </>
          )}
        </div>

        {message && <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        {connected && (
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              가져온 일정 ({items.length}건 · 활성 {status.data?.enabledCount ?? 0}건)
            </p>

            <p className="text-xs text-slate-500 dark:text-slate-400">
              새로 가져온 일정은 <strong>비활성</strong>입니다.{" "}
              <strong>선택</strong>은 여러 개 고른 뒤 일괄 처리할 때 쓰고,{" "}
              <strong>활성</strong>은 그 줄만 바로 MyOwn 업무에 반영해요.
            </p>

            {items.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  className="rounded border border-surface-border px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  onClick={toggleSelectAll}
                >
                  {allSelected ? "전체 해제" : "전체 선택"}
                </button>
                <button
                  type="button"
                  className="rounded border border-surface-border px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  onClick={() => selectByEnabled(false)}
                >
                  비활성만 선택
                </button>
                <button
                  type="button"
                  className="rounded border border-surface-border px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                  onClick={() => selectByEnabled(true)}
                >
                  활성만 선택
                </button>
                <span className="text-[11px] text-slate-400 dark:text-slate-500">|</span>
                <button
                  type="button"
                  className="rounded border border-brand/30 bg-brand/5 px-2 py-1 text-[11px] text-brand hover:bg-brand/10 disabled:opacity-50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
                  disabled={selectedIds.length === 0 || batchPending}
                  onClick={() => batchSetEnabled.mutate({ ids: selectedIds, enabled: true })}
                >
                  선택 항목 활성화 ({selectedIds.length})
                </button>
                <button
                  type="button"
                  className="rounded border border-surface-border px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  disabled={selectedIds.length === 0 || batchPending}
                  onClick={() => batchSetEnabled.mutate({ ids: selectedIds, enabled: false })}
                >
                  선택 항목 비활성화
                </button>
              </div>
            )}

            {imports.isLoading && <p className="text-xs text-slate-500 dark:text-slate-400">일정 불러오는 중…</p>}

            {!imports.isLoading && items.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                아직 가져온 일정이 없습니다. 「일정 가져오기」를 눌러 주세요.
              </p>
            )}

            {items.length > 0 && (
              <div className="max-h-80 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={toggleSelectAll}
                          aria-label="전체 선택"
                        />
                      </th>
                      <th className="px-3 py-2">활성</th>
                      <th className="px-3 py-2">일정</th>
                      <th className="px-3 py-2">시작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item) => (
                      <tr key={item.id} className="border-t border-slate-100 dark:border-slate-700">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={selected.has(item.id)}
                            onChange={() => toggleRowSelected(item.id)}
                            aria-label={`${item.title} 선택`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            disabled={batchPending}
                            onChange={() => toggleEnabled(item)}
                            aria-label={`${item.title} 활성화`}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-medium text-slate-800 dark:text-slate-100">{item.title}</div>
                          {item.description && (
                            <div className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap text-slate-600 dark:text-slate-300">
                          {formatDateTime(item.startsAt)}
                          {item.allDay && (
                            <span className="ml-1 text-slate-400 dark:text-slate-500">(종일)</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
