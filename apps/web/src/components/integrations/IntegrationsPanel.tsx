import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";
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
      return "text-emerald-600";
    case "error":
      return "text-red-600";
    case "unavailable":
      return "text-slate-400";
    default:
      return "text-slate-500";
  }
}

function IntegrationRow({ item }: { item: IntegrationDto }) {
  const muted = item.status === "unavailable";

  return (
    <li
      className={`flex items-center justify-between rounded-lg px-3 py-2 ${
        item.status === "connected" ? "bg-slate-50" : ""
      } ${muted ? "text-slate-400" : "text-slate-700"}`}
      title={item.description}
    >
      <div className="min-w-0">
        <span className="text-sm">{item.name}</span>
        {item.displayName && item.status === "connected" && (
          <p className="truncate text-[11px] text-slate-500">{item.displayName}</p>
        )}
      </div>
      <span className={`shrink-0 text-xs ${statusClass(item.status)}`}>
        {statusLabel(item.status)}
      </span>
    </li>
  );
}

export function IntegrationsPanel() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["integrations"],
    queryFn: api.listIntegrations,
  });

  return (
    <div className="mb-6">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
        연동 APP
      </p>
      {isLoading && <p className="text-xs text-slate-500">불러오는 중…</p>}
      {error && (
        <p className="text-xs text-red-600">
          {error instanceof Error ? error.message : "연동 목록을 불러오지 못했습니다."}
        </p>
      )}
      {data && (
        <ul className="space-y-1">
          {data.items.map((item) => (
            <IntegrationRow key={item.provider} item={item} />
          ))}
        </ul>
      )}
    </div>
  );
}
