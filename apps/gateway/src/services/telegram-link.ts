import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";
import { config } from "../config.js";
import type { ChannelConnectionRepository, UserRepository } from "@myown/database";

const LINK_PREFIX = "telegram:link:";
const LINK_TTL_SEC = 900;

interface LinkRecord {
  status: "pending" | "completed";
  webAccountId: string;
  userId: string;
  telegramUserId?: number;
}

export class TelegramLinkService {
  private botUsername: string | null = null;

  constructor(
    private readonly redis: Redis,
    private readonly users: UserRepository,
    private readonly channelConnections: ChannelConnectionRepository,
  ) {}

  async createLink(
    webAccountId: string,
    userId: string,
  ): Promise<{ token: string; botUrl: string; expiresIn: number }> {
    const token = randomBytes(16).toString("hex");
    const record: LinkRecord = { status: "pending", webAccountId, userId };
    await this.redis.setex(`${LINK_PREFIX}${token}`, LINK_TTL_SEC, JSON.stringify(record));

    const username = await this.getBotUsername();
    return {
      token,
      botUrl: `https://t.me/${username}?start=link_${token}`,
      expiresIn: LINK_TTL_SEC,
    };
  }

  async getLinkStatus(
    token: string,
  ): Promise<
    | { status: "pending" | "completed"; userId?: string }
    | { status: "expired" | "invalid" }
  > {
    const raw = await this.redis.get(`${LINK_PREFIX}${token}`);
    if (!raw) return { status: "expired" };

    try {
      const record = JSON.parse(raw) as LinkRecord;
      if (record.status === "completed") {
        return { status: "completed", userId: record.userId };
      }
      return { status: "pending" };
    } catch {
      return { status: "invalid" };
    }
  }

  async isPendingToken(token: string): Promise<boolean> {
    const status = await this.getLinkStatus(token);
    return status.status === "pending";
  }

  async completeLink(
    token: string,
    telegramUserId: number,
    displayName?: string,
  ): Promise<{ ok: true; userId: string } | { ok: false; message: string }> {
    const key = `${LINK_PREFIX}${token}`;
    const raw = await this.redis.get(key);
    if (!raw) {
      return { ok: false, message: "연결 링크가 만료되었습니다. 웹에서 다시 시도해 주세요." };
    }

    let record: LinkRecord;
    try {
      record = JSON.parse(raw) as LinkRecord;
    } catch {
      return { ok: false, message: "잘못된 연결 링크입니다." };
    }

    if (record.status === "completed") {
      return { ok: false, message: "이미 사용된 연결 링크입니다." };
    }

    const existingTg = await this.users.findByTelegramId(telegramUserId);
    if (existingTg && existingTg.id !== record.userId) {
      return {
        ok: false,
        message: "이 Telegram 계정은 다른 사용자에 이미 연결되어 있습니다.",
      };
    }

    const user = await this.users.findById(record.userId);
    if (!user || user.webAccountId !== record.webAccountId) {
      return { ok: false, message: "연결 대상 사용자를 찾을 수 없습니다." };
    }

    if (user.telegramUserId && user.telegramUserId !== telegramUserId) {
      return {
        ok: false,
        message: "이미 다른 Telegram 계정이 연결되어 있습니다.",
      };
    }

    const linked = user.telegramUserId
      ? user
      : await this.users.linkTelegram(user.id, telegramUserId);
    if (!linked) {
      return { ok: false, message: "Telegram 연결에 실패했습니다." };
    }

    await this.channelConnections.ensureTelegram(linked.id, telegramUserId, displayName);

    const completed: LinkRecord = {
      ...record,
      status: "completed",
      telegramUserId,
    };
    await this.redis.setex(key, 300, JSON.stringify(completed));

    return { ok: true, userId: linked.id };
  }

  private async getBotUsername(): Promise<string> {
    if (this.botUsername) return this.botUsername;

    const response = await fetch(
      `https://api.telegram.org/bot${config.telegramBotToken}/getMe`,
    );
    if (!response.ok) {
      throw new Error("Telegram 봇 정보를 가져오지 못했습니다.");
    }

    const body = (await response.json()) as {
      ok: boolean;
      result?: { username?: string };
    };
    const username = body.result?.username;
    if (!username) {
      throw new Error("봇 사용자명(@username)이 없습니다. BotFather에서 설정해 주세요.");
    }

    this.botUsername = username;
    return username;
  }
}
