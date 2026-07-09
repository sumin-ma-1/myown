import { InlineKeyboard } from "grammy";
import { dashboardLinkLabel, dashboardWebLink } from "../utils/web-links.js";

export function dashboardInlineKeyboard(): InlineKeyboard | undefined {
  const url = dashboardWebLink();
  if (!url) return undefined;
  return new InlineKeyboard().url(`🌐 ${dashboardLinkLabel()}`, url);
}
