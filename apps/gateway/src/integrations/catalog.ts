import type { ChannelConnection, ChannelProvider } from "@myown/database";
import { sanitizeConnectionDisplayName } from "./privacy.js";

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
    description: "카카오톡 채널로 업무 등록·조회",
    available: false,
  },
  {
    provider: "slack",
    name: "Slack",
    description: "워크스페이스 앱 연동",
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
  /** 사람이 읽을 수 있는 이름만 (숫자 ID 미포함) */
  displayName: string | null;
  connectedAt: string | null;
}

function toPublicDto(
  item: IntegrationCatalogItem,
  conn: ChannelConnection | undefined,
  status: IntegrationDto["status"],
): IntegrationDto {
  return {
    provider: item.provider,
    name: item.name,
    description: item.description,
    available: item.available,
    status,
    connectionId: conn?.id ?? null,
    displayName:
      item.provider === "kakao"
        ? null
        : sanitizeConnectionDisplayName(conn?.displayName ?? null),
    connectedAt: conn?.connectedAt?.toISOString() ?? null,
  };
}

export function buildIntegrationList(
  connections: ChannelConnection[],
  options?: { kakaoEnabled?: boolean },
): IntegrationDto[] {
  const byProvider = new Map(connections.map((c) => [c.provider, c]));

  return INTEGRATION_CATALOG.map((item) => {
    const available =
      item.provider === "kakao" ? Boolean(options?.kakaoEnabled) : item.available;
    const catalogItem = { ...item, available };
    const conn = byProvider.get(item.provider);

    if (!available) {
      return toPublicDto(catalogItem, undefined, "unavailable");
    }

    if (!conn || conn.status !== "connected") {
      return toPublicDto(
        catalogItem,
        conn,
        conn?.status === "error" ? "error" : "disconnected",
      );
    }

    return toPublicDto(catalogItem, conn, "connected");
  });
}
