import type { Bot } from "grammy";
import type { AppContext } from "../../context.js";
import type { BotContext } from "../bot.js";
import { telegramDisplayName } from "../../integrations/privacy.js";

const HELP_TEXT = [
  "안녕하세요, MyOwn 업무 관리 개인 비서 봇입니다.",
  "",
  "자연어로 업무 등록 예시:",
  '"기획 보고서 작성해야함. 내일 오후 3시까지"',
  "",
  "첨부파일 등록 방법:",
  "· 파일+캡션: 한 번에 업무 등록",
  "· 파일만: 업무 메모 추가 후 [등록 완료]",
  "· [등록 취소]로 등록 세션 종료",
  "· [답장하기]로 이어서 업무 메모 입력",
  "",
  "명령어:",
  "/help: 도움말",
  "/list: 활성 업무 목록",
  "/today: 오늘 마감 업무",
  "/done <번호>: 업무 완료",
  "/add <제목> [YYYY-MM-DD] [HH:MM]: 업무 등록",
  "  · HH:MM = 그때까지 마감 (알림은 마감 전 자동)",
  "/remind <번호> [YYYY-MM-DD] HH:MM: 추가 알림",
  "/remind <번호> 5분: N분 후 알림",
  "",
  "기본 마감 알림: D-3, D-1(마감 시각 기준), 당일 07:00 (+ 시각 마감 시 1시간 전)",
  "예시:",
  "/add 회의 준비 2026-06-15 14:00  ← 6/15 14:00까지",
  "/remind 1 5분",
  "/remind 1 14:00",
  "1번 10분 후에 알려줘",
  "1번 내일 15시에 알려줘",
].join("\n");

export function registerCommandHandlers(bot: Bot<BotContext>, app: AppContext) {
  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_TEXT);
  });

  bot.command("start", async (ctx) => {
    const payload = ctx.match?.trim();
    if (payload?.startsWith("link_")) {
      const token = payload.slice(5);
      const telegramUserId = ctx.from?.id;
      if (!telegramUserId) return;

      const result = await app.telegramLink.completeLink(
        token,
        telegramUserId,
        telegramDisplayName(ctx.from),
      );

      if (result.ok) {
        await ctx.reply(
          [
            "✅ 웹 대시보드와 Telegram이 연결되었습니다.",
            "",
            "이제 자연어 또는 명령어로 업무를 등록하거나 알림을 받을 수 있습니다.",
            "/help: 도움말",
          ].join("\n"),
        );
        return;
      }

      await ctx.reply(`⚠️ ${result.message}`);
      return;
    }

    await ctx.reply(HELP_TEXT);
  });

  bot.command("list", async (ctx) => {
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply("⚠️ 사용자 세션을 불러오지 못했습니다. DB 연결을 확인해 주세요.");
      return;
    }
    const text = await app.taskService.listActive(userId);
    await ctx.reply(text);
  });

  bot.command("today", async (ctx) => {
    const userId = ctx.session.userId;
    if (!userId) {
      await ctx.reply("⚠️ 사용자 세션을 불러오지 못했습니다. DB 연결을 확인해 주세요.");
      return;
    }
    const text = await app.taskService.listToday(userId);
    await ctx.reply(text);
  });

  bot.command("done", async (ctx) => {
    const userId = ctx.session.userId;
    if (!userId) return;

    const arg = ctx.match?.trim();
    if (!arg || !/^\d+$/.test(arg)) {
      await ctx.reply("사용법: /done <번호>\n예: /done 1");
      return;
    }

    const result = await app.taskService.completeByIndex(userId, Number(arg));
    await ctx.reply(
      result.ok ? `✅ ${result.task.title} 완료 처리했습니다.` : result.message,
    );
  });

  bot.command("add", async (ctx) => {
    const userId = ctx.session.userId;
    const telegramUserId = ctx.from?.id;
    if (!userId || !telegramUserId) return;

    const raw = ctx.match?.trim();
    if (!raw) {
      await ctx.reply("사용법: /add <제목> [YYYY-MM-DD] [HH:MM]\n예: /add 보고서 2026-06-15 14:00");
      return;
    }

    const reply = await app.agent.handleMessage({
      userId,
      telegramUserId,
      text: `/add ${raw}`,
      activeTasks: await app.tasks.listActive(userId),
    });
    await ctx.reply(reply);
  });

  bot.command("remind", async (ctx) => {
    const userId = ctx.session.userId;
    const telegramUserId = ctx.from?.id;
    if (!userId || !telegramUserId) return;

    const raw = ctx.match?.trim();
    if (!raw) {
      await ctx.reply(
        "사용법:\n/remind 1 5분\n/remind 1 14:00 (오늘)\n/remind 1 2026-06-15 14:00",
      );
      return;
    }

    const reply = await app.agent.handleMessage({
      userId,
      telegramUserId,
      text: `/remind ${raw}`,
      activeTasks: await app.tasks.listActive(userId),
    });
    await ctx.reply(reply);
  });
}
