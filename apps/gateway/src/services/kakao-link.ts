import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";
import type { ChannelConnectionRepository, UserRepository } from "@myown/database";
import { config } from "../config.js";

const LINK_PREFIX = "kakao:link:";
const LINK_TTL_SEC = 900;

interface LinkRecord {
  status: "pending" | "completed";
  webAccountId: string;
  userId: string;
  kakaoUserId?: string;
}

export class KakaoLinkService {
  constructor(
    private readonly redis: Redis,
    private readonly users: UserRepository,
    private readonly channelConnections: ChannelConnectionRepository,
  ) {}

  async createLink(
    webAccountId: string,
    userId: string,
  ): Promise<{ token: string; channelUrl: string; linkPhrase: string; expiresIn: number }> {
    const token = randomBytes(16).toString("hex");
    const record: LinkRecord = { status: "pending", webAccountId, userId };
    await this.redis.setex(`${LINK_PREFIX}${token}`, LINK_TTL_SEC, JSON.stringify(record));

    const linkPhrase = `연결 link_${token}`;
    return {
      token,
      channelUrl: config.kakaoChannelUrl,
      linkPhrase,
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
    kakaoUserId: string,
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

    const existingKakao = await this.channelConnections.findByProviderAndExternalId(
      "kakao",
      kakaoUserId,
    );
    if (existingKakao && existingKakao.userId !== record.userId) {
      return {
        ok: false,
        message: "이 카카오 계정은 다른 사용자에 이미 연결되어 있습니다.",
      };
    }

    const user = await this.users.findById(record.userId);
    if (!user || user.webAccountId !== record.webAccountId) {
      return { ok: false, message: "연결 대상 사용자를 찾을 수 없습니다." };
    }

    const existingForUser = await this.channelConnections.findByUserAndProvider(
      user.id,
      "kakao",
    );
    if (
      existingForUser?.status === "connected" &&
      existingForUser.externalId !== kakaoUserId
    ) {
      return {
        ok: false,
        message: "이미 다른 카카오 계정이 연결되어 있습니다.",
      };
    }

    await this.channelConnections.ensureKakao(user.id, kakaoUserId);

    const completed: LinkRecord = {
      ...record,
      status: "completed",
      kakaoUserId,
    };
    await this.redis.setex(key, 300, JSON.stringify(completed));

    return { ok: true, userId: user.id };
  }
}
