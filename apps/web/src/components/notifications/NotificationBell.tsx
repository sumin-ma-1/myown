import { useCallback, useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "@/api/client";
import type { UserNotificationDto } from "@/api/types";
import { Switch } from "@/components/ui/Switch";
import { formatDateTime } from "@/lib/dates";

const PANEL_WIDTH = 320;
const GOOGLE_CALENDAR_HASH_PATH = "/integrations#google-calendar";

function linksToGoogleCalendar(item: UserNotificationDto): boolean {
  if (item.type === "gcal_auth_expired") return true;
  if (item.type !== "gcal_auto_sync") return false;
  if (item.payload?.activateImports === false) return true;
  return typeof item.body === "string" && item.body.includes("검토 대기");
}

export function NotificationBell({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({});
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const notifications = useQuery({
    queryKey: ["notifications"],
    queryFn: () => api.listNotifications({ limit: 30 }),
    refetchInterval: 45_000,
  });

  const settings = useQuery({
    queryKey: ["settings"],
    queryFn: api.getSettings,
    enabled: open,
  });

  const integrations = useQuery({
    queryKey: ["integrations"],
    queryFn: api.listIntegrations,
    enabled: open,
  });

  const markRead = useMutation({
    mutationFn: (id: string) => api.markNotificationRead(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllRead = useMutation({
    mutationFn: api.markAllNotificationsRead,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const saveChannels = useMutation({
    mutationFn: (channels: { telegram?: boolean; kakao?: boolean }) =>
      api.updateSettings({ notification: { channels } }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["settings"] });
    },
  });

  const updatePanelPosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const margin = 8;
    const preferredLeft = compact ? rect.left : rect.right - PANEL_WIDTH;
    const left = Math.min(
      Math.max(margin, preferredLeft),
      window.innerWidth - PANEL_WIDTH - margin,
    );
    const top = Math.min(rect.bottom + 8, window.innerHeight - margin);
    setPanelStyle({
      position: "fixed",
      top,
      left,
      width: PANEL_WIDTH,
      maxHeight: Math.max(200, window.innerHeight - top - margin),
    });
  }, [compact]);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onReposition = () => updatePanelPosition();
    window.addEventListener("resize", onReposition);
    window.addEventListener("scroll", onReposition, true);
    return () => {
      window.removeEventListener("resize", onReposition);
      window.removeEventListener("scroll", onReposition, true);
    };
  }, [open, updatePanelPosition]);

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

  const unreadCount = notifications.data?.unreadCount ?? 0;
  const items = notifications.data?.items ?? [];
  const telegramLinked = integrations.data?.items?.some(
    (item) => item.provider === "telegram" && item.status === "connected",
  );
  const telegramEnabled = settings.data?.notification.channels?.telegram !== false;
  const kakaoEnabled = settings.data?.notification.channels?.kakao === true;

  return (
    <div className={compact ? "" : "shrink-0"}>
      <button
        ref={buttonRef}
        type="button"
        className={`relative rounded-lg p-1.5 transition-colors ${
          open
            ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-300"
            : "text-amber-500/80 hover:bg-amber-50 hover:text-amber-600 dark:text-amber-400/70 dark:hover:bg-amber-950/40 dark:hover:text-amber-300"
        }`}
        aria-label="알림"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <span className="material-icons text-[19px] leading-none" aria-hidden>
          notifications
        </span>
        {unreadCount > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open &&
        createPortal(
          <div
            ref={panelRef}
            style={panelStyle}
            className="z-[60] flex flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
            role="dialog"
            aria-label="알림 목록"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-3 py-2 dark:border-slate-700">
              <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">알림 센터</p>
              <button
                type="button"
                className="text-[11px] text-brand hover:underline disabled:opacity-50 dark:text-blue-300"
                disabled={unreadCount === 0 || markAllRead.isPending}
                onClick={() => markAllRead.mutate()}
              >
                모두 확인
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {notifications.isLoading ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">불러오는 중…</p>
              ) : items.length === 0 ? (
                <p className="px-3 py-6 text-center text-xs text-slate-500">알림을 모두 확인하였어요.</p>
              ) : (
                <ul>
                  {items.map((item) => (
                    <NotificationRow
                      key={item.id}
                      item={item}
                      onSelect={() => {
                        if (!item.readAt) markRead.mutate(item.id);
                        if (!linksToGoogleCalendar(item)) return;
                        setOpen(false);
                        navigate(GOOGLE_CALENDAR_HASH_PATH);
                        // Same-route hash clicks may not remount; scroll explicitly.
                        window.setTimeout(() => {
                          document.getElementById("google-calendar")?.scrollIntoView({
                            behavior: "smooth",
                            block: "start",
                          });
                        }, 80);
                      }}
                    />
                  ))}
                </ul>
              )}
            </div>

            <div className="shrink-0 space-y-3 border-t border-slate-200 px-3 py-3 dark:border-slate-700">
              <p className="text-[11px] font-medium text-slate-600 dark:text-slate-300">
                채널 알림
              </p>
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-slate-800 dark:text-slate-100">Telegram</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {telegramLinked ? "연결됨" : "연동 APP에서 연결 필요"}
                  </p>
                </div>
                <Switch
                  checked={telegramEnabled}
                  disabled={!telegramLinked || saveChannels.isPending}
                  aria-label="Telegram 알림"
                  onCheckedChange={(enabled) =>
                    saveChannels.mutate({ telegram: enabled, kakao: kakaoEnabled })
                  }
                />
              </div>
              <div className="flex items-center justify-between gap-2 opacity-70">
                <div className="min-w-0">
                  <p className="text-xs text-slate-800 dark:text-slate-100">KakaoTalk</p>
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">준비 중</p>
                </div>
                <Switch
                  checked={false}
                  disabled
                  aria-label="KakaoTalk 알림 (준비 중)"
                  onCheckedChange={() => undefined}
                />
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function NotificationRow({
  item,
  onSelect,
}: {
  item: UserNotificationDto;
  onSelect: () => void;
}) {
  const unread = !item.readAt;
  return (
    <li>
      <button
        type="button"
        className={`w-full border-b border-slate-100 px-3 py-2.5 text-left last:border-0 dark:border-slate-800 ${
          unread
            ? "bg-sky-50/70 hover:bg-sky-50 dark:bg-sky-950/30 dark:hover:bg-sky-950/50"
            : "hover:bg-slate-50 dark:hover:bg-slate-800/60"
        }`}
        onClick={onSelect}
      >        <div className="flex items-start justify-between gap-2">
          <p
            className={`text-xs ${
              unread
                ? "font-semibold text-slate-900 dark:text-slate-50"
                : "font-medium text-slate-700 dark:text-slate-200"
            }`}
          >
            {item.title}
          </p>
          {unread && (
            <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-sky-500" aria-hidden />
          )}
        </div>
        <p className="mt-0.5 text-[11px] text-slate-600 dark:text-slate-300">{item.body}</p>
        <p className="mt-1 text-[10px] text-slate-400 dark:text-slate-500">
          {formatDateTime(item.createdAt)}
        </p>
      </button>
    </li>
  );
}
