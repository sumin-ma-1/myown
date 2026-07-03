export interface KakaoSkillRequest {
  intent?: {
    id?: string;
    name?: string;
  };
  userRequest: {
    utterance: string;
    user: {
      id: string;
      type?: string;
      properties?: Record<string, string>;
    };
    timezone?: string;
    lang?: string;
  };
  bot?: {
    id?: string;
    name?: string;
  };
  action?: {
    id?: string;
    name?: string;
    params?: Record<string, string>;
    detailParams?: Record<string, { origin?: string; value?: string }>;
  };
}

export interface KakaoSkillResponse {
  version: "2.0";
  template: {
    outputs: Array<{
      simpleText?: { text: string };
    }>;
  };
}

export function kakaoDisplayName(user: KakaoSkillRequest["userRequest"]["user"]): string | undefined {
  const props = user.properties ?? {};
  return props.plusfriendUserKey ?? props.botUserKey ?? props.appUserId ?? undefined;
}

export function extractLinkToken(utterance: string): string | null {
  const trimmed = utterance.trim();
  const match = trimmed.match(/(?:^|\s)link_([a-f0-9]{32})(?:\s|$)/i);
  return match?.[1] ?? null;
}
