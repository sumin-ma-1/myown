import type { ChannelConnection, ChannelProvider } from "@myown/database";

export interface IntegrationCatalogItem {
  provider: ChannelProvider;
  name: string;
  description: string;
  available: boolean;
}

export const INTEGRATION_CATALOG: IntegrationCatalogItem[] = [
  {
    provider: "telegram",
    name: "Telegram",
    description: "봇으로 업무 등록·알림 수신",
    available: true,
  },
  {
    provider: "kakao",
    name: "KakaoTalk",
    description: "카카오 채널 연동 (준비 중)",
    available: false,
  },
  {
    provider: "slack",
    name: "Slack",
    description: "워크스페이스 앱 연동 (준비 중)",
    available: false,
  },
];

export interface IntegrationDto {
  provider: ChannelProvider;
  name: string;
  description: string;
  available: boolean;
  status: "connected" | "disconnected" | "error" | "unavailable";
  connectionId: string | null;
  displayName: string | null;
  externalId: string | null;
  connectedAt: string | null;
}

export function buildIntegrationList(
  connections: ChannelConnection[],
): IntegrationDto[] {
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return INTEGRATION_CATALOG.map((item) => {
    const conn = byProvider.get(item.provider);

    if (!item.available) {
      return {
        provider: item.provider,
        name: item.name,
        description: item.description,
        available: false,
        status: "unavailable" as const,
        connectionId: null,
        displayName: null,
        externalId: null,
        connectedAt: null,
      };
    }

    if (!conn || conn.status !== "connected") {
      return {
        provider: item.provider,
        name: item.name,
        description: item.description,
        available: true,
        status: conn?.status === "error" ? ("error" as const) : ("disconnected" as const),
        connectionId: conn?.id ?? null,
        displayName: conn?.displayName ?? null,
        externalId: conn?.externalId ?? null,
        connectedAt: conn?.connectedAt?.toISOString() ?? null,
      };
    }

    return {
      provider: item.provider,
      name: item.name,
      description: item.description,
      available: true,
      status: "connected" as const,
      connectionId: conn.id,
      displayName: conn.displayName,
      externalId: conn.externalId,
      connectedAt: conn.connectedAt.toISOString(),
    };
  });
}
