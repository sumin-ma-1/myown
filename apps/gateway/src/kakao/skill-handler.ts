import type { AppContext } from "../context.js";
import type { KakaoSkillRequest } from "./types.js";
import { extractLinkToken, kakaoDisplayName } from "./types.js";
import { kakaoMultiTextResponse, kakaoTextResponse } from "./response.js";

const HELP_TEXT = [
  "안녕하세요, MyOwn 업무 관리 비서입니다.",
  "",
  "명령어:",
  "목록 — 활성 업무 목록",
  "오늘 — 오늘 마감 업무",
  "완료 1 — 1번 업무 완료",
  "추가 보고서 2026-06-15 14:00 — 업무 등록",
  "알림 1 5분 — N분 후 알림",
  "",
  "자연어 (LLM 설정 시):",
  '"내일 오후 3시까지 보고서 작성해줘"',
  "",
  "※ 알림 발송은 Telegram 연동 시 우선 지원됩니다.",
].join("\n");

function normalizeCommand(utterance: string): string {
  const text = utterance.trim();
  if (text.startsWith("/")) return text.slice(1).trim();
  return text;
}

function toAgentText(utterance: string): string | null {
  const text = normalizeCommand(utterance);

  if (/^(help|도움말|시작)$/i.test(text)) return null;

  if (/^(list|목록|리스트)$/i.test(text)) return "/list";
  if (/^(today|오늘)$/i.test(text)) return "/today";

  const doneMatch = text.match(/^(?:done|완료)\s+(\d+)$/i);
  if (doneMatch) return `/done ${doneMatch[1]}`;

  const addMatch = text.match(/^(?:add|추가)\s+(.+)$/i);
  if (addMatch) return `/add ${addMatch[1]}`;

  const remindMatch = text.match(/^(?:remind|알림)\s+(.+)$/i);
  if (remindMatch) return `/remind ${remindMatch[1]}`;

  return text;
}

async function resolveConnectedUser(app: AppContext, kakaoUserId: string) {
  const conn = await app.channelConnections.findByProviderAndExternalId("kakao", kakaoUserId);
  if (!conn || conn.status !== "connected") return null;

  const user = await app.users.findById(conn.userId);
  if (!user) return null;

  return { user, conn };
}

export async function handleKakaoSkill(app: AppContext, body: KakaoSkillRequest) {
  const utterance = body.userRequest?.utterance?.trim() ?? "";
  const kakaoUserId = body.userRequest?.user?.id;

  if (!kakaoUserId) {
    return kakaoTextResponse("⚠️ 사용자 정보를 확인할 수 없습니다.");
  }

  const linkToken = extractLinkToken(utterance);
  if (linkToken) {
    const result = await app.kakaoLink.completeLink(
      linkToken,
      kakaoUserId,
      kakaoDisplayName(body.userRequest.user),
    );
    if (result.ok) {
      return kakaoTextResponse(
        [
          "✅ 웹 대시보드와 카카오톡이 연결되었습니다.",
          "",
          "이제 채널에서 업무를 등록하고 조회할 수 있습니다.",
          "「목록」— 활성 업무",
          "「도움말」— 명령어 안내",
        ].join("\n"),
      );
    }
    return kakaoTextResponse(`⚠️ ${result.message}`);
  }

  const connected = await resolveConnectedUser(app, kakaoUserId);
  if (!connected) {
    return kakaoTextResponse(
      [
        "⛔ 아직 연동되지 않았습니다.",
        "",
        "웹 대시보드 → 연동 APP → KakaoTalk에서",
        "「카카오 연결」을 누른 뒤, 안내된 문구를 이 채팅에 입력해 주세요.",
      ].join("\n"),
    );
  }

  const { user } = connected;

  if (!utterance || /^(help|도움말|시작)$/i.test(normalizeCommand(utterance))) {
    return kakaoMultiTextResponse(HELP_TEXT);
  }

  const agentText = toAgentText(utterance);
  if (!agentText) {
    return kakaoMultiTextResponse(HELP_TEXT);
  }

  if (agentText.startsWith("/done ")) {
    const arg = agentText.slice(6).trim();
    if (!/^\d+$/.test(arg)) {
      return kakaoTextResponse("사용법: 완료 1");
    }
    const result = await app.taskService.completeByIndex(user.id, Number(arg));
    return kakaoTextResponse(
      result.ok ? `✅ ${result.task.title} 완료 처리했습니다.` : result.message,
    );
  }

  if (agentText === "/list") {
    const text = await app.taskService.listActive(user.id);
    return kakaoMultiTextResponse(text);
  }

  if (agentText === "/today") {
    const text = await app.taskService.listToday(user.id);
    return kakaoMultiTextResponse(text);
  }

  try {
    const telegramUserId = user.telegramUserId ?? 0;
    const reply = await app.agent.handleMessage({
      userId: user.id,
      telegramUserId,
      text: agentText,
      activeTasks: await app.tasks.listActive(user.id),
    });
    return kakaoMultiTextResponse(reply);
  } catch (err) {
    console.error("[kakao] skill handler error:", err);
    return kakaoTextResponse(
      "⚠️ 처리 중 오류가 발생했습니다. 「목록」, 「추가」 명령어를 사용해 주세요.",
    );
  }
}
