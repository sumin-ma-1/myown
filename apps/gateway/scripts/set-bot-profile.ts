import { config as loadEnv } from "dotenv";
import { Bot, InputFile } from "grammy";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
loadEnv({ path: resolve(rootDir, ".env") });

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN이 .env에 없습니다.");
  process.exit(1);
}

const brandDir = resolve(rootDir, "assets/brand");
const botProfilePath = resolve(brandDir, "bot-profile.png");
const faviconPath = resolve(brandDir, "favicon.png");
const photoPath = existsSync(botProfilePath) ? botProfilePath : faviconPath;

if (!existsSync(photoPath)) {
  console.error(
    `프로필 이미지를 찾을 수 없습니다.\n` +
      `  우선: ${botProfilePath}\n` +
      `  대체: ${faviconPath}`,
  );
  process.exit(1);
}

const bot = new Bot(token);

await bot.api.setMyProfilePhoto({
  type: "static",
  photo: new InputFile(photoPath),
});

const used = photoPath === botProfilePath ? "bot-profile.png" : "favicon.png (fallback)";
console.log(`✅ 텔레그램 봇 프로필 사진이 업데이트되었습니다. (${used})`);
