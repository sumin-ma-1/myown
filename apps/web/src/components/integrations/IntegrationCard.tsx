import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/api/client";
import type { IntegrationDto } from "@/api/types";
import { IntegrationTitle } from "@/components/integrations/IntegrationIcon";
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
      return "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400";
    case "error":
      return "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-400";
    case "unavailable":
      return "bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500";
    default:
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300";
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
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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
      <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-400">
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
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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

function KakaoActions({ item }: { item: IntegrationDto }) {
  const queryClient = useQueryClient();
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const [linkPhrase, setLinkPhrase] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const startLink = useMutation({
    mutationFn: api.startKakaoLink,
    onSuccess: (data) => {
      setLinkError(null);
      setLinkToken(data.token);
      setLinkPhrase(data.linkPhrase);
      window.open(data.channelUrl, "_blank", "noopener,noreferrer");
    },
    onError: (err) => {
      setLinkError(err instanceof Error ? err.message : "연결을 시작하지 못했습니다.");
    },
  });

  const linkStatus = useQuery({
    queryKey: ["kakao-link", linkToken],
    queryFn: () => api.getKakaoLinkStatus(linkToken!),
    enabled: Boolean(linkToken) && item.status !== "connected",
    refetchInterval: (query) =>
      query.state.data?.status === "pending" ? 2000 : false,
  });

  useEffect(() => {
    if (linkStatus.data?.status === "completed") {
      setLinkToken(null);
      setLinkPhrase(null);
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    }
  }, [linkStatus.data?.status, queryClient]);

  const sync = useMutation({
    mutationFn: () => api.syncIntegration("kakao"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const disconnect = useMutation({
    mutationFn: () => api.disconnectIntegration("kakao"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const linking = Boolean(linkToken) && linkStatus.data?.status === "pending";

  const copyPhrase = async () => {
    if (!linkPhrase) return;
    try {
      await navigator.clipboard.writeText(linkPhrase);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setLinkError("문구를 복사하지 못했습니다. 직접 입력해 주세요.");
    }
  };

  if (item.status === "connected") {
    return (
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
          disabled={sync.isPending}
          onClick={() => sync.mutate()}
        >
          연결 새로고침
        </button>
        <button
          type="button"
          className="rounded-lg border border-red-200 px-3 py-1.5 text-xs text-red-700 hover:bg-red-50"
          disabled={disconnect.isPending}
          onClick={() => disconnect.mutate()}
        >
          연결 해제
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <ol className="list-decimal space-y-1 pl-4 text-xs text-slate-600 dark:text-slate-400">
        <li>아래 「카카오 연결」을 누릅니다.</li>
        <li>열리는 카카오톡 채널에서 <strong>채널 추가</strong> 후 채팅을 엽니다.</li>
        <li>아래 「채널에 입력할 문구」를 채팅에 붙여넣고 전송합니다.</li>
        <li>이 페이지로 돌아오면 자동으로 연결됩니다.</li>
      </ol>
      {linkPhrase && (
        <div className="rounded-lg border border-surface-border bg-slate-50 p-3 text-xs dark:border-slate-600 dark:bg-slate-900/50">
          <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">채널에 입력할 문구</p>
          <code className="block break-all text-slate-800 dark:text-slate-200">{linkPhrase}</code>
          <button
            type="button"
            className="mt-2 rounded border border-surface-border bg-white px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
            onClick={() => void copyPhrase()}
          >
            {copied ? "복사됨" : "문구 복사"}
          </button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-50"
          disabled={startLink.isPending || linking}
          onClick={() => startLink.mutate()}
        >
          {linking ? "연결 대기 중…" : "카카오 연결"}
        </button>
        <button
          type="button"
          className="rounded-lg border border-surface-border px-3 py-1.5 text-xs text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-300 dark:hover:bg-slate-700"
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
  const cardId = `integration-${item.provider}`;

  return (
    <Card
      id={cardId}
      className="scroll-mt-6"
      onClick={() => {
        document.getElementById(cardId)?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }}
      title={<IntegrationTitle id={item.provider} name={item.name} />}
    >
      <div className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <p className={`text-sm ${muted ? "text-slate-400 dark:text-slate-500" : "text-slate-600 dark:text-slate-300"}`}>
            {item.description}
          </p>
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium ${statusClass(item.status)}`}
          >
            {statusLabel(item.status)}
          </span>
        </div>

        {item.status === "connected" && (
          <div className="text-xs text-slate-500 dark:text-slate-400">
            {item.displayName && <p>표시 이름: {item.displayName}</p>}
            {connectedAt && <p>연결: {connectedAt}</p>}
          </div>
        )}

        {item.provider === "telegram" && item.available && (
          <div onClick={(event) => event.stopPropagation()}>
            <TelegramActions item={item} />
          </div>
        )}

        {item.provider === "kakao" && item.available && (
          <div onClick={(event) => event.stopPropagation()}>
            <KakaoActions item={item} />
          </div>
        )}
      </div>
    </Card>
  );
}
