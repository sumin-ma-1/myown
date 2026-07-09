import type { KakaoSkillResponse } from "./types.js";
import { dashboardLinkLabel, dashboardWebLink } from "../utils/web-links.js";

function withDashboardQuickReply(response: KakaoSkillResponse): KakaoSkillResponse {
  const url = dashboardWebLink();
  if (!url) return response;

  return {
    ...response,
    template: {
      ...response.template,
      quickReplies: [
        {
          label: dashboardLinkLabel(),
          action: "webLink",
          webLinkUrl: url,
        },
      ],
    },
  };
}

export function kakaoTextResponse(text: string): KakaoSkillResponse {
  return withDashboardQuickReply({
    version: "2.0",
    template: {
      outputs: [{ simpleText: { text } }],
    },
  });
}

export function splitKakaoText(text: string, maxLen = 900): string[] {
  if (text.length <= maxLen) return [text];

  const chunks: string[] = [];
  let rest = text;
  while (rest.length > maxLen) {
    let cut = rest.lastIndexOf("\n", maxLen);
    if (cut < maxLen / 2) cut = maxLen;
    chunks.push(rest.slice(0, cut).trimEnd());
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  return chunks;
}

export function kakaoMultiTextResponse(text: string): KakaoSkillResponse {
  const parts = splitKakaoText(text);
  return withDashboardQuickReply({
    version: "2.0",
    template: {
      outputs: parts.map((part) => ({ simpleText: { text: part } })),
    },
  });
}
