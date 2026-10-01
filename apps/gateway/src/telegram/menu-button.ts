import type { Bot } from "grammy";
import type { BotContext } from "./bot.js";
import { dashboardLinkLabel, dashboardMiniAppUrl } from "../utils/web-links.js";

const MENU_BUTTON_LABEL = dashboardLinkLabel();

export async function setupTelegramMenuButton(bot: Bot<BotContext>): Promise<void> {
  try {
    await bot.api.setMyCommands([
      { command: "web", description: "웹 대시보드 (브라우저에서 열기)" },
      { command: "help", description: "도움말" },
      { command: "list", description: "활성 업무 목록" },
      { command: "today", description: "오늘 마감 업무" },
    ]);

    const url = dashboardMiniAppUrl();
    if (!url) {
      await bot.api.setChatMenuButton({
        menu_button: { type: "commands" },
      });
      console.info(
        "INFO: WEB_APP_URL is not HTTPS — Mini App menu skipped. URL buttons (/web) still work over HTTP.",
      );
      return;
    }

    await bot.api.setChatMenuButton({
      menu_button: {
        type: "web_app",
        text: MENU_BUTTON_LABEL,
        web_app: { url },
      },
    });
    console.info(`Telegram menu button set: ${MENU_BUTTON_LABEL}`);
  } catch (err) {
    console.error("[bot] setChatMenuButton failed:", err);
  }
}
