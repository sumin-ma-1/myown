import type {
  UserNotification,
  UserNotificationRepository,
  UserNotificationType,
  UserRepository,
} from "@myown/database";
import type { UserPreferences } from "../api/types.js";

export type TelegramTextSender = (telegramUserId: number, text: string) => Promise<void>;

const AUTH_EXPIRED_DEDUP_MS = 6 * 60 * 60 * 1000;

export class NotificationService {
  private telegramSender: TelegramTextSender | null = null;

  constructor(
    private readonly notifications: UserNotificationRepository,
    private readonly users: UserRepository,
  ) {}

  setTelegramSender(sender: TelegramTextSender | null): void {
    this.telegramSender = sender;
  }

  async notify(input: {
    userId: string;
    type: UserNotificationType;
    title: string;
    body: string;
    payload?: Record<string, unknown>;
  }): Promise<UserNotification | null> {
    if (input.type === "gcal_auth_expired") {
      const recent = await this.notifications.hasRecentUnreadOfType(
        input.userId,
        "gcal_auth_expired",
        AUTH_EXPIRED_DEDUP_MS,
      );
      if (recent) return null;
    }

    const row = await this.notifications.create({
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      payload: input.payload,
    });

    void this.pushToTelegram(
      input.userId,
      input.type === "gcal_auto_sync" ? input.body : `${input.title}\n${input.body}`,
    ).catch((err) => {
      console.error(`[notify] telegram push failed for ${input.userId}:`, err);
    });

    return row;
  }

  async notifyGcalAutoSync(
    userId: string,
    result: { imported: number; updated: number; activateImports: boolean },
  ): Promise<void> {
    if (result.imported <= 0 && result.updated <= 0) return;

    const parts: string[] = [];
    if (result.imported > 0) {
      parts.push(
        result.activateImports
          ? `신규 ${result.imported}건을 업무로 등록`
          : `신규 ${result.imported}건을 검토 대기 목록에 추가`,
      );
    }
    if (result.updated > 0) {
      parts.push(`${result.updated}건 갱신`);
    }

    await this.notify({
      userId,
      type: "gcal_auto_sync",
      title: "Google Calendar 자동 가져오기",
      body: `${parts.join(", ")}했어요.`,
      payload: {
        imported: result.imported,
        updated: result.updated,
        activateImports: result.activateImports,
      },
    });
  }

  async notifyGcalAuthExpired(userId: string): Promise<void> {
    await this.notify({
      userId,
      type: "gcal_auth_expired",
      title: "Google Calendar 연결 만료",
      body: "연결이 만료되어 자동으로 해지되었습니다. 연동 APP에서 다시 연결해 주세요.",
    });
  }

  /** 설정 변경 확인 등 — 채널 토글과 무관하게 Telegram 연결만 있으면 발송 */
  async sendTelegramToUser(userId: string, text: string): Promise<void> {
    if (!this.telegramSender) return;

    const user = await this.users.findById(userId);
    if (!user?.telegramUserId) return;

    await this.telegramSender(user.telegramUserId, text);
  }

  private async pushToTelegram(userId: string, text: string): Promise<void> {
    if (!this.telegramSender) return;

    const user = await this.users.findById(userId);
    if (!user?.telegramUserId) return;

    const prefs = (user.preferences ?? {}) as UserPreferences;
    if (prefs.notification?.channels?.telegram === false) return;

    await this.telegramSender(user.telegramUserId, text);
  }
}
