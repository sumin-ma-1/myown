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

const photoPath = resolve(rootDir, "assets/brand/favicon.png");
if (!existsSync(photoPath)) {
  console.error(`로고 파일을 찾을 수 없습니다: ${photoPath}`);
  process.exit(1);
}

const bot = new Bot(token);

await bot.api.setMyProfilePhoto({
  type: "static",
  photo: new InputFile(photoPath),
});

console.log("✅ 텔레그램 봇 프로필 사진이 업데이트되었습니다.");
