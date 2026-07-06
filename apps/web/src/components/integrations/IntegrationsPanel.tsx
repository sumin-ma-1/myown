import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
import {
  IntegrationIcon,
  type IntegrationIconId,
} from "@/components/integrations/IntegrationIcon";
import type { IntegrationDto, IntegrationStatus } from "@/api/types";

function statusLabel(status: IntegrationStatus): string {
  switch (status) {
    case "connected":
      return "연결됨";
    case "disconnected":
      return "미연결";
    case "error":
      return "오류";
    case "unavailable":
      return "예정";
  }
}

function statusClass(status: IntegrationStatus): string {
  switch (status) {
    case "connected":
      return "text-emerald-600 dark:text-emerald-400";
    case "error":
      return "text-red-600 dark:text-red-400";
    case "unavailable":
      return "text-slate-400 dark:text-slate-500";
    default:
      return "text-slate-500 dark:text-slate-400";
  }
}

interface PanelRowProps {
  iconId: IntegrationIconId;
  name: string;
  description: string;
  status: IntegrationStatus;
  subtitle?: string | null;
}

function PanelRow({
  iconId,
  name,
  description,
  status,
  subtitle,
  compact = false,
}: PanelRowProps & { compact?: boolean }) {
  const muted = status === "unavailable";
  const tooltip = compact
    ? `${name} · ${statusLabel(status)}`
    : description;

  if (compact) {
    return (
      <li title={tooltip}>
        <div
          className={`flex items-center justify-center rounded-lg p-1.5 ${
            status === "connected" ? "bg-slate-50 dark:bg-slate-800/60" : ""
          } ${muted ? "opacity-40" : ""}`}
        >
          <IntegrationIcon id={iconId} size={18} />
        </div>
      </li>
    );
  }

  return (
    <li
      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
        status === "connected" ? "bg-slate-50 dark:bg-slate-800/60" : ""
      } ${muted ? "text-slate-400 dark:text-slate-500" : "text-slate-700 dark:text-slate-200"}`}
      title={description}
    >
      <div className="flex min-w-0 items-center gap-2">
        <IntegrationIcon id={iconId} size={18} />
        <div className="min-w-0">
          <span className="text-sm">{name}</span>
          {subtitle && status === "connected" && (
            <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>
      </div>
      <span className={`shrink-0 text-xs ${statusClass(status)}`}>
        {statusLabel(status)}
      </span>
    </li>
  );
}

function IntegrationRow({ item, compact }: { item: IntegrationDto; compact?: boolean }) {
  return (
    <PanelRow
      iconId={item.provider}
      name={item.name}
      description={item.description}
      status={item.status}
      subtitle={item.displayName}
      compact={compact}
    />
  );
}

function googleCalendarStatus(
  data: { available: boolean; connected: boolean } | undefined,
): IntegrationStatus {
  if (!data?.available) return "unavailable";
  if (data.connected) return "connected";
  return "disconnected";
}

interface IntegrationsPanelProps {
  compact?: boolean;
}

export function IntegrationsPanel({ compact = false }: IntegrationsPanelProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: api.listIntegrations,
  });

  const googleCalendar = useQuery({
    queryKey: ["google-calendar-status"],
    queryFn: api.getGoogleCalendarStatus,
  });

  const telegram = data?.items.find((i) => i.provider === "telegram");
  const needsLink = telegram?.status === "disconnected";
  const gcalStatus = googleCalendarStatus(googleCalendar.data);

  return (
    <div className={compact ? "mb-4 w-full" : "mb-6"}>
      {!compact && (
        <Link
          to="/integrations"
          className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-400 transition hover:text-brand dark:text-slate-500"
        >
          연동 APP
        </Link>
      )}
      {isLoading && !compact && <p className="text-xs text-slate-500">불러오는 중…</p>}
      {isLoading && compact && (
        <p className="text-center text-[10px] text-slate-400" title="불러오는 중…">
          …
        </p>
      )}
      {error && !compact && (
        <p className="text-xs text-red-600">
          {error instanceof Error ? error.message : "연동 목록을 불러오지 못했습니다."}
        </p>
      )}
      {data && (
        <>
          <ul className={compact ? "flex flex-col items-center gap-1" : "space-y-1"}>
            {data.items.map((item) => (
              <IntegrationRow key={item.provider} item={item} compact={compact} />
            ))}
            {googleCalendar.data && (
              <PanelRow
                iconId="google-calendar"
                name="Google Calendar"
                description="Google Calendar 일정을 가져와 업무로 활성화"
                status={gcalStatus}
                subtitle={googleCalendar.data.googleEmail}
                compact={compact}
              />
            )}
          </ul>
          {needsLink && !compact && (
            <Link
              to="/integrations"
              className="mt-2 block rounded-lg bg-brand-muted px-3 py-2 text-center text-xs font-medium text-brand hover:opacity-90"
            >
              Telegram 연결하기
            </Link>
          )}
        </>
      )}
    </div>
  );
}