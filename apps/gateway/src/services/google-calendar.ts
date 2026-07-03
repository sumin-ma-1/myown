import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";
import type {
  CalendarImport,
  CalendarImportRepository,
  GoogleCalendarConnectionRepository,
  TaskRepository,
  UserRepository,
} from "@myown/database";
import { config, isGoogleAuthEnabled } from "../config.js";
import type { TaskService } from "./task.js";

const OAUTH_STATE_PREFIX = "gcal:oauth:";
const OAUTH_STATE_TTL_SEC = 600;
const CALENDAR_READONLY_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

interface OAuthState {
  userId: string;
  webAccountId: string;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  error?: string;
}

interface GoogleUserInfo {
  email?: string;
}

interface GoogleCalendarEvent {
  id?: string;
  summary?: string;
  description?: string;
  etag?: string;
  htmlLink?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
}

interface GoogleEventsListResponse {
  items?: GoogleCalendarEvent[];
  error?: { message?: string };
}

export interface CalendarImportDto {
  id: string;
  googleEventId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  allDay: boolean;
  enabled: boolean;
  taskId: string | null;
  htmlLink: string | null;
  lastSyncedAt: string;
}

export class GoogleCalendarService {
  constructor(
    private readonly redis: Redis,
    private readonly connections: GoogleCalendarConnectionRepository,
    private readonly imports: CalendarImportRepository,
    private readonly users: UserRepository,
    private readonly tasks: TaskRepository,
    private readonly taskService: TaskService,
  ) {}

  static isAvailable(): boolean {
    return isGoogleAuthEnabled();
  }

  calendarRedirectUri(): string {
    return (
      process.env.GOOGLE_CALENDAR_REDIRECT_URI ??
      `${config.webAppUrl}/api/integrations/google-calendar/callback`
    );
  }

  async getStatus(userId: string): Promise<{
    connected: boolean;
    googleEmail: string | null;
    importCount: number;
    enabledCount: number;
  }> {
    const conn = await this.connections.findByUserId(userId);
    const all = await this.imports.listByUserId(userId);
    return {
      connected: Boolean(conn),
      googleEmail: conn?.googleEmail ?? null,
      importCount: all.length,
      enabledCount: all.filter((i) => i.enabled).length,
    };
  }

  async beginConnect(userId: string, webAccountId: string): Promise<string> {
    if (!GoogleCalendarService.isAvailable()) {
      throw new Error("Google OAuth가 설정되지 않았습니다.");
    }

    const state = randomBytes(24).toString("hex");
    const payload: OAuthState = { userId, webAccountId };
    await this.redis.setex(
      `${OAUTH_STATE_PREFIX}${state}`,
      OAUTH_STATE_TTL_SEC,
      JSON.stringify(payload),
    );

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.googleClientId);
    url.searchParams.set("redirect_uri", this.calendarRedirectUri());
    url.searchParams.set("response_type", "code");
    url.searchParams.set(
      "scope",
      ["openid", "email", CALENDAR_READONLY_SCOPE].join(" "),
    );
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");

    return url.toString();
  }

  async completeConnect(code: string, state: string): Promise<{ ok: true } | { ok: false; message: string }> {
    const stateKey = `${OAUTH_STATE_PREFIX}${state}`;
    const rawState = await this.redis.get(stateKey);
    if (!rawState) {
      return { ok: false, message: "연결 세션이 만료되었습니다. 다시 시도해 주세요." };
    }
    await this.redis.del(stateKey);

    let oauthState: OAuthState;
    try {
      oauthState = JSON.parse(rawState) as OAuthState;
    } catch {
      return { ok: false, message: "잘못된 연결 요청입니다." };
    }

    const token = await this.exchangeCode(code);
    if (!token.refresh_token && !token.access_token) {
      return {
        ok: false,
        message: "Google Calendar 권한을 받지 못했습니다. 다시 연결해 주세요.",
      };
    }

    const profile = token.access_token
      ? await this.fetchUserInfo(token.access_token)
      : { email: undefined };

    const existing = await this.connections.findByUserId(oauthState.userId);
    const refreshToken = token.refresh_token ?? existing?.refreshToken;
    if (!refreshToken) {
      return {
        ok: false,
        message:
          "refresh token이 없습니다. Google 계정 연결 해제 후 다시 시도하거나 prompt=consent로 재연결해 주세요.",
      };
    }

    await this.connections.upsert({
      userId: oauthState.userId,
      googleEmail: profile.email,
      refreshToken,
      accessToken: token.access_token,
      accessTokenExpiresAt: token.expires_in
        ? new Date(Date.now() + token.expires_in * 1000)
        : undefined,
    });

    return { ok: true };
  }

  async disconnect(userId: string): Promise<void> {
    await this.connections.deleteByUserId(userId);
    await this.imports.deleteByUserId(userId);
  }

  async sync(
    userId: string,
    options?: { pastDays?: number; futureDays?: number },
  ): Promise<{ imported: number; updated: number }> {
    const conn = await this.connections.findByUserId(userId);
    if (!conn) {
      throw new Error("Google Calendar가 연결되지 않았습니다.");
    }

    const pastDays = clampDays(options?.pastDays ?? 7, 0, 365);
    const futureDays = clampDays(options?.futureDays ?? 90, 1, 365);

    const accessToken = await this.getAccessToken(userId);
    const timeMin = new Date();
    timeMin.setDate(timeMin.getDate() - pastDays);
    const timeMax = new Date();
    timeMax.setDate(timeMax.getDate() + futureDays);

    const events = await this.fetchEvents(accessToken, timeMin, timeMax);
    let imported = 0;
    let updated = 0;

    for (const event of events) {
      if (!event.id || event.status === "cancelled") continue;
      const parsed = this.parseEvent(event);
      if (!parsed) continue;

      const existing = await this.imports.findByGoogleEventId(userId, event.id);
      await this.imports.upsertFromGoogle({
        userId,
        googleEventId: event.id,
        googleCalendarId: "primary",
        ...parsed,
      });
      if (existing) updated += 1;
      else imported += 1;
    }

    return { imported, updated };
  }

  async listImports(
    userId: string,
    options?: { from?: string; to?: string },
  ): Promise<CalendarImportDto[]> {
    const from = options?.from ? new Date(options.from) : undefined;
    const to = options?.to ? new Date(options.to) : undefined;
    const rows = await this.imports.listByUserId(userId, { from, to });
    return rows.map((row) => this.toDto(row));
  }

  async setImportEnabled(
    userId: string,
    importId: string,
    enabled: boolean,
  ): Promise<CalendarImportDto> {
    const row = await this.imports.findById(userId, importId);
    if (!row) {
      throw new Error("일정을 찾을 수 없습니다.");
    }

    if (enabled) {
      const taskId = await this.ensureTaskForImport(userId, row);
      const updated = await this.imports.setEnabled(userId, importId, true, taskId);
      if (!updated) throw new Error("일정 활성화에 실패했습니다.");
      return this.toDto(updated);
    }

    if (row.taskId) {
      await this.tasks.update(userId, row.taskId, { status: "cancelled" });
    }
    const updated = await this.imports.setEnabled(userId, importId, false, null);
    if (!updated) throw new Error("일정 비활성화에 실패했습니다.");
    return this.toDto(updated);
  }

  async setImportsEnabled(
    userId: string,
    importIds: string[],
    enabled: boolean,
  ): Promise<CalendarImportDto[]> {
    const results: CalendarImportDto[] = [];
    for (const id of importIds) {
      results.push(await this.setImportEnabled(userId, id, enabled));
    }
    return results;
  }

  private async ensureTaskForImport(userId: string, row: CalendarImport): Promise<string> {
    if (row.taskId) {
      const existing = await this.tasks.findById(userId, row.taskId);
      if (existing && existing.status === "active") {
        return existing.id;
      }
      if (existing && existing.status !== "active") {
        await this.tasks.update(userId, existing.id, {
          status: "active",
          title: row.title,
          description: row.description,
          dueAt: row.startsAt,
        });
        return existing.id;
      }
    }

    const user = await this.users.findById(userId);
    const telegramUserId = user?.telegramUserId ?? 0;
    const task = await this.taskService.create({
      userId,
      telegramUserId,
      title: row.title,
      description: row.description ?? undefined,
      dueAt: row.startsAt,
      skipReminders: telegramUserId === 0,
    });
    return task.id;
  }

  private toDto(row: CalendarImport): CalendarImportDto {
    return {
      id: row.id,
      googleEventId: row.googleEventId,
      title: row.title,
      description: row.description,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt?.toISOString() ?? null,
      allDay: row.allDay,
      enabled: row.enabled,
      taskId: row.taskId,
      htmlLink: row.htmlLink,
      lastSyncedAt: row.lastSyncedAt.toISOString(),
    };
  }

  private parseEvent(event: GoogleCalendarEvent): {
    title: string;
    description?: string | null;
    startsAt: Date;
    endsAt?: Date | null;
    allDay: boolean;
    htmlLink?: string | null;
    etag?: string | null;
  } | null {
    const title = event.summary?.trim() || "(제목 없음)";
    const allDay = Boolean(event.start?.date && !event.start?.dateTime);

    if (allDay && event.start?.date) {
      const startsAt = new Date(`${event.start.date}T09:00:00+09:00`);
      const endsAt = event.end?.date
        ? new Date(`${event.end.date}T23:59:59+09:00`)
        : null;
      return {
        title,
        description: event.description ?? null,
        startsAt,
        endsAt,
        allDay: true,
        htmlLink: event.htmlLink ?? null,
        etag: event.etag ?? null,
      };
    }

    if (!event.start?.dateTime) return null;
    const startsAt = new Date(event.start.dateTime);
    const endsAt = event.end?.dateTime ? new Date(event.end.dateTime) : null;
    if (Number.isNaN(startsAt.getTime())) return null;

    return {
      title,
      description: event.description ?? null,
      startsAt,
      endsAt,
      allDay: false,
      htmlLink: event.htmlLink ?? null,
      etag: event.etag ?? null,
    };
  }

  private async getAccessToken(userId: string): Promise<string> {
    const conn = await this.connections.findByUserId(userId);
    if (!conn) throw new Error("Google Calendar가 연결되지 않았습니다.");

    if (
      conn.accessToken &&
      conn.accessTokenExpiresAt &&
      conn.accessTokenExpiresAt.getTime() > Date.now() + 60_000
    ) {
      return conn.accessToken;
    }

    const body = new URLSearchParams({
      client_id: config.googleClientId,
      client_secret: config.googleClientSecret,
      refresh_token: conn.refreshToken,
      grant_type: "refresh_token",
    });

    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
    const data = (await res.json()) as GoogleTokenResponse;
    if (!res.ok || !data.access_token) {
      throw new Error(data.error ?? "Google 토큰 갱신에 실패했습니다.");
    }

    const expiresAt = new Date(Date.now() + (data.expires_in ?? 3600) * 1000);
    await this.connections.updateTokens(userId, {
      accessToken: data.access_token,
      accessTokenExpiresAt: expiresAt,
    });
    return data.access_token;
  }

  private async exchangeCode(code: string): Promise<GoogleTokenResponse> {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: this.calendarRedirectUri(),
        grant_type: "authorization_code",
      }),
    });
    return (await res.json()) as GoogleTokenResponse;
  }

  private async fetchUserInfo(accessToken: string): Promise<GoogleUserInfo> {
    const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) return {};
    return (await res.json()) as GoogleUserInfo;
  }

  private async fetchEvents(
    accessToken: string,
    timeMin: Date,
    timeMax: Date,
  ): Promise<GoogleCalendarEvent[]> {
    const url = new URL(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
    );
    url.searchParams.set("timeMin", timeMin.toISOString());
    url.searchParams.set("timeMax", timeMax.toISOString());
    url.searchParams.set("singleEvents", "true");
    url.searchParams.set("orderBy", "startTime");
    url.searchParams.set("maxResults", "250");

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const data = (await res.json()) as GoogleEventsListResponse;
    if (!res.ok) {
      throw new Error(data.error?.message ?? "Google Calendar 일정을 가져오지 못했습니다.");
    }
    return data.items ?? [];
  }
}

function clampDays(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, Math.round(value)));
}
