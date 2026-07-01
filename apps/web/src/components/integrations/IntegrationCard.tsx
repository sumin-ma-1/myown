import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { IntegrationDto } from "@/api/types";
import { Card } from "@/components/ui/Card";

function statusLabel(status: IntegrationDto["status"]): string {
  switch (status) {
    case "connected":
      return "연결됨";
    case "disconnected":
      return "미연결";
    case "error":
      return "오류";
    case "unavailable":
      return "준비 중";
  }
}

function statusClass(status: IntegrationDto["status"]): string {
  switch (status) {
    case "connected":
      return "bg-emerald-50 text-emerald-700";
    case "error":
      return "bg-red-50 text-red-700";
    case "unavailable":
      return "bg-slate-100 text-slate-400";
    default:
      return "bg-slate-100 text-slate-600";
  }
}

function formatConnectedAt(iso: string | null): string | null {
  if (!iso) return null;
  try {
    return new Date(iso).toLocaleString("ko-KR", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return null;
  }
}

function TelegramActions({ item }: { item: IntegrationDto }) {
  const queryClient = useQueryClient();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);

  const startLink = useMutation({
    mutationFn: api.startTelegramLink,
    onSuccess: (data) => {
      setLinkError(null);
      setLinkToken(data.token);
      window.open(data.botUrl, "_blank", "noopener,noreferrer");
    },
    onError: (err) => {
      setLinkError(err instanceof Error ? err.message : "연결을 시작하지 못했습니다.");
    },
  });

  const linkStatus = useQuery({
    queryKey: ["telegram-link", linkToken],
    queryFn: () => api.getTelegramLinkStatus(linkToken!),
    enabled: Boolean(linkToken) && item.status !== "connected",
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
  });

  useEffect(() => {
    if (linkStatus.data?.status === "completed") {
      setLinkToken(null);
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    }
  }, [linkStatus.data?.status, queryClient]);

  const sync = useMutation({
    mutationFn: () => api.syncIntegration("telegram"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const linking = Boolean(linkToken) && linkStatus.data?.status === "pending";

  if (item.status === "connected") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
        >
          연결 새로고침
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-600">
        <li>아래 「Telegram 연결」을 누릅니다.</li>
        <li>열리는 Telegram에서 <strong>시작(Start)</strong>을 누릅니다.</li>
        <li>이 페이지로 돌아오면 자동으로 연결됩니다.</li>
      </ol>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          disabled={startLink.isPending || linking}
          onClick={() => startLink.mutate()}
        >
          {linking ? "연결 대기 중…" : "Telegram 연결"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50"
          disabled={sync.isPending || linking}
          onClick={() => sync.mutate()}
        >
          연결 확인
        </button>
      </div>
      {linkError && <p className="text-xs text-red-600">{linkError}</p>}
      {linkStatus.data?.status === "expired" && (
        <p className="text-xs text-amber-700">링크가 만료되었습니다. 다시 시도해 주세요.</p>
      )}
    </div>
  );
}

export function IntegrationCard({ item }: { item: IntegrationDto }) {
  const connectedAt = formatConnectedAt(item.connectedAt);
  const muted = item.status === "unavailable";

  return (
    <Card title={item.name}>
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm ${muted ? "text-slate-400" : "text-slate-600"}`}>
            {item.description}
          </p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(item.status)}`}
          >
            {statusLabel(item.status)}
          </span>
        </div>

        {item.status === "connected" && (
          <div className="text-xs text-slate-500">
            {item.displayName && <p>표시 이름: {item.displayName}</p>}
            {connectedAt && <p>연결: {connectedAt}</p>}
          </div>
        )}

        {item.provider === "telegram" && item.available && (
          <TelegramActions item={item} />
        )}

        {item.status === "unavailable" && (
          <p className="text-xs text-slate-400">추후 지원 예정입니다.</p>
        )}
      </div>
    </Card>
  );
}
