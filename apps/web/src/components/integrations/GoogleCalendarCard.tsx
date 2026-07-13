import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";
import type { CalendarImportDto } from "@/api/types";
import { IntegrationTitle } from "@/components/integrations/IntegrationIcon";
import { Card } from "@/components/ui/Card";
import { Switch } from "@/components/ui/Switch";
import { formatDateTime } from "@/lib/dates";

function statusLabel(connected: boolean): string {
  return connected ? "연결됨" : "미연결";
}

function statusClass(connected: boolean): string {
  return connected
    ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400"
    : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
}

const PAGE_SIZE_OPTIONS = [10, 20, 50] as const;

const AUTO_SYNC_INTERVAL_OPTIONS = [
  { hours: 6 as const, label: "6시간마다" },
  { hours: 12 as const, label: "12시간마다" },
  { hours: 24 as const, label: "하루에 한 번" },
  { hours: 48 as const, label: "2일에 한 번" },
  { hours: 168 as const, label: "일주일에 한 번" },
];

function matchesImportSearch(item: CalendarImportDto, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    item.title.toLowerCase().includes(q) ||
    (item.description?.toLowerCase().includes(q) ?? false)
  );
}

function isInManualSyncWindow(
  startsAt: string,
  pastDays: number,
  futureDays: number,
): boolean {
  const start = new Date(startsAt);
  const rangeFrom = new Date();
  rangeFrom.setHours(0, 0, 0, 0);
  rangeFrom.setDate(rangeFrom.getDate() - pastDays);
  const rangeTo = new Date();
  rangeTo.setHours(23, 59, 59, 999);
  rangeTo.setDate(rangeTo.getDate() + futureDays);
  return start >= rangeFrom && start <= rangeTo;
}

export function GoogleCalendarCard() {
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pastDays, setPastDays] = useState(7);
  const [futureDays, setFutureDays] = useState(90);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(false);
  const [autoSyncIntervalHours, setAutoSyncIntervalHours] = useState<6 | 12 | 24 | 48 | 168>(24);
  const [autoSyncPastDays, setAutoSyncPastDays] = useState(7);
  const [autoSyncFutureDays, setAutoSyncFutureDays] = useState(90);
  const [autoSyncActivateImports, setAutoSyncActivateImports] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showEnabledImports, setShowEnabledImports] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<(typeof PAGE_SIZE_OPTIONS)[number]>(20);

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

  useEffect(() => {
    const auto = status.data?.autoSync;
    if (!auto) return;
    setAutoSyncEnabled(auto.autoSyncEnabled);
    setAutoSyncIntervalHours(auto.autoSyncIntervalHours);
    setAutoSyncPastDays(auto.autoSyncPastDays);
    setAutoSyncFutureDays(auto.autoSyncFutureDays);
    setAutoSyncActivateImports(auto.autoSyncActivateImports);
  }, [status.data?.autoSync]);

  const autoSyncSettings = (overrides?: {
    autoSyncEnabled?: boolean;
    autoSyncIntervalHours?: number;
    autoSyncPastDays?: number;
    autoSyncFutureDays?: number;
    autoSyncActivateImports?: boolean;
  }) => ({
    autoSyncEnabled,
    autoSyncIntervalHours,
    autoSyncPastDays,
    autoSyncFutureDays,
    autoSyncActivateImports,
    ...overrides,
  });

  const saveAutoSync = useMutation({
    mutationFn: (body: {
      autoSyncEnabled?: boolean;
      autoSyncIntervalHours?: number;
      autoSyncPastDays?: number;
      autoSyncFutureDays?: number;
      autoSyncActivateImports?: boolean;
    }) => api.updateGoogleCalendarSettings(body),
    onSuccess: () => {
      setError(null);
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-status"] });
      void queryClient.invalidateQueries({ queryKey: ["google-calendar-imports"] });
    },
    onError: (err) => {
      setError(err instanceof Error ? err.message : "자동 가져오기 설정 저장에 실패했습니다.");
    },
  });

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

  const allItems = imports.data?.items ?? [];
  const pendingItems = useMemo(
    () =>
      allItems.filter(
        (item) =>
          !item.enabled && isInManualSyncWindow(item.startsAt, pastDays, futureDays),
      ),
    [allItems, pastDays, futureDays],
  );
  const enabledItems = useMemo(() => allItems.filter((item) => item.enabled), [allItems]);
  const visibleItems = useMemo(
    () => (showEnabledImports ? [...pendingItems, ...enabledItems] : pendingItems),
    [showEnabledImports, pendingItems, enabledItems],
  );
  const filteredItems = useMemo(
    () => visibleItems.filter((item) => matchesImportSearch(item, searchQuery)),
    [visibleItems, searchQuery],
  );
  const filteredPendingItems = useMemo(
    () => filteredItems.filter((item) => !item.enabled),
    [filteredItems],
  );
  const pageCount = Math.max(1, Math.ceil(filteredItems.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paginatedItems = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filteredItems.slice(start, start + pageSize);
  }, [filteredItems, safePage, pageSize]);
  const pagePendingItems = useMemo(
    () => paginatedItems.filter((item) => !item.enabled),
    [paginatedItems],
  );

  useEffect(() => {
    setPage(1);
  }, [searchQuery, showEnabledImports, pageSize, pastDays, futureDays]);

  useEffect(() => {
    if (page > pageCount) setPage(pageCount);
  }, [page, pageCount]);

  const connected = Boolean(status.data?.connected);
  const available = status.data?.available !== false;
  const selectedIds = useMemo(() => [...selected], [selected]);
  const allSelected =
    filteredPendingItems.length > 0 &&
    filteredPendingItems.every((item) => selected.has(item.id));
  const allPagePendingSelected =
    pagePendingItems.length > 0 && pagePendingItems.every((item) => selected.has(item.id));
  const batchPending = setEnabled.isPending || batchSetEnabled.isPending;

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const item of filteredPendingItems) next.delete(item.id);
        return next;
      });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of filteredPendingItems) next.add(item.id);
      return next;
    });
  };

  const togglePageSelectAll = () => {
    if (allPagePendingSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        for (const item of pagePendingItems) next.delete(item.id);
        return next;
      });
      return;
    }
    setSelected((prev) => {
      const next = new Set(prev);
      for (const item of pagePendingItems) next.add(item.id);
      return next;
    });
  };

  const toggleRowSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const activateImport = (item: CalendarImportDto) => {
    if (item.enabled) return;
    setEnabled.mutate({ id: item.id, enabled: true });
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
            Google Calendar 일정을 가져온 뒤, 원하는 항목만 MyOwn 업무로 활성화해요.
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

        {connected && (
          <div className="space-y-3 rounded-xl border border-surface-border bg-slate-50/60 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 space-y-1">
                <p className="text-xs font-medium text-slate-800 dark:text-slate-100">
                  자동 일정 가져오기
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Google Calendar 일정을 자동으로 가져와요.
                </p>
              </div>
              <Switch
                checked={autoSyncEnabled}
                disabled={saveAutoSync.isPending}
                aria-label="자동 일정 가져오기"
                onCheckedChange={(enabled) => {
                  setAutoSyncEnabled(enabled);
                  saveAutoSync.mutate(autoSyncSettings({ autoSyncEnabled: enabled }));
                }}
              />
            </div>
            {autoSyncEnabled && (
              <>
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs text-slate-700 dark:text-slate-200">
                      가져온 일정 MyOwn 업무로 자동 활성화
                    </p>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      끄면 검토 대기 목록에 추가돼요.
                    </p>
                  </div>
                  <Switch
                    checked={autoSyncActivateImports}
                    disabled={saveAutoSync.isPending}
                    aria-label="가져온 일정을 MyOwn 업무로 자동 활성화"
                    onCheckedChange={(enabled) => {
                      setAutoSyncActivateImports(enabled);
                      saveAutoSync.mutate(autoSyncSettings({ autoSyncActivateImports: enabled }));
                    }}
                  />
                </div>
                <div className="flex flex-wrap items-end gap-3 text-xs">
                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-300">주기</span>
                  <select
                    className="block rounded-lg border border-surface-border bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={autoSyncIntervalHours}
                    disabled={saveAutoSync.isPending}
                    onChange={(e) => {
                      const hours = Number(e.target.value) as 6 | 12 | 24 | 48 | 168;
                      setAutoSyncIntervalHours(hours);
                      saveAutoSync.mutate(
                        autoSyncSettings({ autoSyncEnabled: true, autoSyncIntervalHours: hours }),
                      );
                    }}
                  >
                    {AUTO_SYNC_INTERVAL_OPTIONS.map((opt) => (
                      <option key={opt.hours} value={opt.hours}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-300">과거 (일)</span>
                  <input
                    type="number"
                    min={0}
                    max={365}
                    className="block w-20 rounded-lg border border-surface-border bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={autoSyncPastDays}
                    disabled={saveAutoSync.isPending}
                    onChange={(e) => setAutoSyncPastDays(Number(e.target.value))}
                    onBlur={() => saveAutoSync.mutate(autoSyncSettings({ autoSyncEnabled: true }))}
                  />
                </label>
                <label className="space-y-1">
                  <span className="text-slate-600 dark:text-slate-300">앞으로 (일)</span>
                  <input
                    type="number"
                    min={1}
                    max={365}
                    className="block w-20 rounded-lg border border-surface-border bg-white px-2 py-1.5 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    value={autoSyncFutureDays}
                    disabled={saveAutoSync.isPending}
                    onChange={(e) => setAutoSyncFutureDays(Number(e.target.value))}
                    onBlur={() => saveAutoSync.mutate(autoSyncSettings({ autoSyncEnabled: true }))}
                  />
                </label>
              </div>
              </>
            )}
            {status.data?.autoSync?.lastAutoSyncedAt && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                마지막 자동 가져오기: {formatDateTime(status.data.autoSync.lastAutoSyncedAt)}
              </p>
            )}
          </div>
        )}

        {message && <p className="text-xs text-emerald-700 dark:text-emerald-400">{message}</p>}
        {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

        {connected && (
          <div className="space-y-3 border-t border-slate-200 pt-4 dark:border-slate-700">
            <p className="text-xs font-medium text-slate-700 dark:text-slate-200">
              가져온 일정 (검토 대기 {pendingItems.length}건)
            </p>

            <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
              <input
                type="checkbox"
                checked={showEnabledImports}
                onChange={(e) => setShowEnabledImports(e.target.checked)}
              />
              이미 등록된 일정 보기
            </label>

            {visibleItems.length > 0 && (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  {filteredPendingItems.length > 0 && (
                    <>
                      <button
                        type="button"
                        className="rounded border border-surface-border px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
                        onClick={toggleSelectAll}
                      >
                        {allSelected ? "전체 해제" : "전체 선택"}
                      </button>
                      <button
                        type="button"
                        className="rounded border border-brand/30 bg-brand/5 px-2 py-1 text-[11px] text-brand hover:bg-brand/10 disabled:opacity-50 dark:bg-blue-950/40 dark:text-blue-300 dark:hover:bg-blue-900/50"
                        disabled={selectedIds.length === 0 || batchPending}
                        onClick={() => batchSetEnabled.mutate({ ids: selectedIds, enabled: true })}
                      >
                        선택 항목 활성화 ({selectedIds.length})
                      </button>
                    </>
                  )}
                </div>
                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-1.5 text-[11px] text-slate-600 dark:text-slate-300">
                    <span className="text-slate-500 dark:text-slate-400">표시</span>
                    <select
                      value={pageSize}
                      onChange={(e) =>
                        setPageSize(Number(e.target.value) as (typeof PAGE_SIZE_OPTIONS)[number])
                      }
                      className="rounded border border-surface-border bg-white px-1.5 py-1 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
                    >
                      {PAGE_SIZE_OPTIONS.map((size) => (
                        <option key={size} value={size}>
                          {size}건
                        </option>
                      ))}
                    </select>
                  </label>
                  <div className="relative">
                    <input
                      type="search"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="일정 제목·설명 검색"
                      className="w-44 rounded-lg border border-surface-border bg-white py-1 pl-2.5 pr-8 text-[11px] dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 sm:w-52"
                    />
                    <span
                      className="material-icons pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[16px] leading-none text-slate-400"
                      aria-hidden
                    >
                      search
                    </span>
                  </div>
                </div>
              </div>
            )}

            {imports.isLoading && <p className="text-xs text-slate-500 dark:text-slate-400">일정 불러오는 중…</p>}

            {!imports.isLoading && allItems.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                아직 가져온 일정이 없습니다. 「일정 가져오기」를 눌러 주세요.
              </p>
            )}

            {!imports.isLoading && allItems.length > 0 && visibleItems.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                신규 일정이 없어요. 「이미 등록된 일정 보기」로 등록된 항목을 확인할 수 있어요.
              </p>
            )}

            {!imports.isLoading && visibleItems.length > 0 && filteredItems.length === 0 && (
              <p className="text-xs text-slate-500 dark:text-slate-400">
                검색 결과가 없어요.
              </p>
            )}

            {filteredItems.length > 0 && (
              <div className="space-y-2">
                <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2">
                        {pagePendingItems.length > 0 && (
                          <input
                            type="checkbox"
                            checked={allPagePendingSelected}
                            onChange={togglePageSelectAll}
                            aria-label="이 페이지 검토 대기 일정 전체 선택"
                          />
                        )}
                      </th>
                      <th className="px-3 py-2">활성</th>
                      <th className="px-3 py-2">일정</th>
                      <th className="px-3 py-2">시작</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedItems.map((item) => (
                      <tr
                        key={item.id}
                        className={`border-t border-slate-100 dark:border-slate-700 ${
                          item.enabled ? "bg-slate-50/60 dark:bg-slate-800/40" : ""
                        }`}
                      >
                        <td className="px-3 py-2">
                          {!item.enabled && (
                            <input
                              type="checkbox"
                              checked={selected.has(item.id)}
                              onChange={() => toggleRowSelected(item.id)}
                              aria-label={`${item.title} 선택`}
                            />
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={item.enabled}
                            disabled={item.enabled || batchPending}
                            onChange={() => activateImport(item)}
                            aria-label={
                              item.enabled ? `${item.title} 업무로 연결됨` : `${item.title} 활성화`
                            }
                          />
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="font-medium text-slate-800 dark:text-slate-100">
                              {item.title}
                            </div>
                            {item.enabled && item.taskId && (
                              <Link
                                to={`/tasks?open=${item.taskId}`}
                                className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950/50 dark:text-emerald-400 dark:hover:bg-emerald-900/50"
                              >
                                등록됨
                              </Link>
                            )}
                          </div>
                          {item.description && (
                            <div className="mt-0.5 line-clamp-2 text-slate-500 dark:text-slate-400">
                              {item.description}
                            </div>
                          )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">
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

                {filteredItems.length > 0 && (
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600 dark:text-slate-300">
                    <span>
                      {filteredItems.length}건 중 {(safePage - 1) * pageSize + 1}-
                      {Math.min(safePage * pageSize, filteredItems.length)}건
                      {searchQuery.trim() ? ` · 검색 결과 ${filteredItems.length}건` : ""}
                    </span>
                    {pageCount > 1 && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          className="rounded border border-surface-border px-2 py-1 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
                          disabled={safePage <= 1}
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                        >
                          이전
                        </button>
                        <span>
                          {safePage} / {pageCount}
                        </span>
                        <button
                          type="button"
                          className="rounded border border-surface-border px-2 py-1 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:hover:bg-slate-700"
                          disabled={safePage >= pageCount}
                          onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                        >
                          다음
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
