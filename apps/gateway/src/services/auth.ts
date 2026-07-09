import { randomBytes } from "node:crypto";
import type { Redis } from "ioredis";
import type {
  InviteCodeRepository,
  LoginEventRepository,
  SessionRepository,
  UserRepository,
  WebAccountRepository,
} from "@myown/database";
import { config, isAdminEmail, isGoogleAuthEnabled } from "../config.js";

const OAUTH_STATE_PREFIX = "auth:oauth:";
const OAUTH_STATE_TTL_SEC = 600;
const TELEGRAM_HANDOFF_PREFIX = "auth:telegram-handoff:";
const TELEGRAM_HANDOFF_TTL_SEC = 300;
const SESSION_COOKIE = "myown_session";

interface OAuthState {
  purpose: "login" | "signup";
  inviteCodeId?: string;
  returnTo?: "telegram";
}

interface GoogleTokenResponse {
  access_token?: string;
  error?: string;
}

interface GoogleUserInfo {
  email?: string;
  email_verified?: boolean;
  name?: string;
}

export class AuthService {
  constructor(
    private readonly redis: Redis,
    private readonly webAccounts: WebAccountRepository,
    private readonly users: UserRepository,
    private readonly inviteCodes: InviteCodeRepository,
    private readonly sessions: SessionRepository,
    private readonly loginEvents: LoginEventRepository,
  ) {}

  static sessionCookieName(): string {
    return SESSION_COOKIE;
  }

  sessionMaxAgeSec(): number {
    return config.sessionTtlDays * 24 * 60 * 60;
  }

  async validateInviteCode(code: string): Promise<
    | { ok: true; allowedEmail: string; code: string }
    | { ok: false; message: string }
  > {
    const invite = await this.inviteCodes.findByCode(code);
    if (!invite || !this.inviteCodes.isUsable(invite)) {
      return { ok: false, message: "유효하지 않거나 이미 사용된 초대코드입니다." };
    }
    return { ok: true, allowedEmail: invite.allowedEmail, code: invite.code };
  }

  async beginGoogleAuth(input: {
    purpose: "login" | "signup";
    inviteCode?: string;
    returnTo?: "telegram";
  }): Promise<{ ok: true; url: string } | { ok: false; message: string }> {
    if (!isGoogleAuthEnabled()) {
      return { ok: false, message: "Google 로그인이 설정되지 않았습니다." };
    }

    let inviteCodeId: string | undefined;

    if (input.purpose === "signup") {
      if (input.inviteCode?.trim()) {
        const invite = await this.inviteCodes.findByCode(input.inviteCode);
        if (!invite || !this.inviteCodes.isUsable(invite)) {
          return { ok: false, message: "유효하지 않거나 이미 사용된 초대코드입니다." };
        }
        inviteCodeId = invite.id;
      }
    }

    const state = randomBytes(24).toString("hex");
    const payload: OAuthState = {
      purpose: input.purpose,
      inviteCodeId,
      returnTo: input.returnTo,
    };
    await this.redis.setex(
      `${OAUTH_STATE_PREFIX}${state}`,
      OAUTH_STATE_TTL_SEC,
      JSON.stringify(payload),
    );

    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.searchParams.set("client_id", config.googleClientId);
    url.searchParams.set("redirect_uri", config.googleRedirectUri);
    url.searchParams.set("response_type", "code");
    url.searchParams.set("scope", "openid email profile");
    url.searchParams.set("state", state);
    url.searchParams.set("access_type", "online");
    url.searchParams.set("prompt", "select_account");

    return { ok: true, url: url.toString() };
  }

  async completeGoogleAuth(
    code: string,
    state: string,
    meta: { ip?: string; userAgent?: string },
  ): Promise<
    | {
        ok: true;
        sessionId: string;
        webAccountId: string;
        telegramHandoffToken?: string;
      }
    | { ok: false; message: string }
  > {
    if (!isGoogleAuthEnabled()) {
      return { ok: false, message: "Google 로그인이 설정되지 않았습니다." };
    }

    const stateKey = `${OAUTH_STATE_PREFIX}${state}`;
    const rawState = await this.redis.get(stateKey);
    if (!rawState) {
      return { ok: false, message: "로그인 세션이 만료되었습니다. 다시 시도해 주세요." };
    }
    await this.redis.del(stateKey);

    let oauthState: OAuthState;
    try {
      oauthState = JSON.parse(rawState) as OAuthState;
    } catch {
      return { ok: false, message: "잘못된 로그인 요청입니다." };
    }

    const profile = await this.fetchGoogleProfile(code);
    if (!profile.email || !profile.email_verified) {
      return { ok: false, message: "Google 이메일 인증이 완료되지 않았습니다." };
    }

    const email = profile.email.trim().toLowerCase();
    let account = await this.webAccounts.findByEmail(email);

    if (oauthState.purpose === "signup") {
      if (account) {
        return { ok: false, message: "이미 가입된 계정입니다. 로그인을 이용해 주세요." };
      }

      let inviteCodeId: string | undefined;

      if (oauthState.inviteCodeId) {
        const invite = await this.inviteCodes.findById(oauthState.inviteCodeId);
        if (!invite || !this.inviteCodes.isUsable(invite)) {
          return { ok: false, message: "초대코드가 더 이상 유효하지 않습니다." };
        }
        if (invite.allowedEmail.toLowerCase() !== email) {
          return {
            ok: false,
            message: `이 초대코드는 ${invite.allowedEmail} 전용입니다. 해당 Google 계정으로 시도해 주세요.`,
          };
        }
        inviteCodeId = invite.id;
      } else if (!isAdminEmail(email)) {
        return { ok: false, message: "가입하려면 초대코드가 필요합니다." };
      }

      const role = isAdminEmail(email) ? "admin" : "user";
      account = await this.webAccounts.create({
        email,
        displayName: profile.name,
        role,
        inviteCodeId,
      });
      await this.users.createForWebAccount(account.id, config.timezone);

      if (inviteCodeId) {
        await this.inviteCodes.markUsed(inviteCodeId, account.id);
      }

      await this.loginEvents.create({
        webAccountId: account.id,
        eventType: "signup",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } else {
      if (!account) {
        return {
          ok: false,
          message: "가입되지 않은 계정입니다. 초대코드와 함께 가입해 주세요.",
        };
      }

      await this.loginEvents.create({
        webAccountId: account.id,
        eventType: "login",
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }

    await this.webAccounts.updateLastLogin(account.id);

    const expiresAt = new Date(Date.now() + this.sessionMaxAgeSec() * 1000);
    const session = await this.sessions.create(account.id, expiresAt);

    let telegramHandoffToken: string | undefined;
    if (oauthState.returnTo === "telegram") {
      telegramHandoffToken = await this.createTelegramHandoffToken(session.id);
    }

    return {
      ok: true,
      sessionId: session.id,
      webAccountId: account.id,
      telegramHandoffToken,
    };
  }

  async createTelegramHandoffToken(sessionId: string): Promise<string> {
    const token = randomBytes(24).toString("hex");
    await this.redis.setex(
      `${TELEGRAM_HANDOFF_PREFIX}${token}`,
      TELEGRAM_HANDOFF_TTL_SEC,
      sessionId,
    );
    return token;
  }

  async completeTelegramHandoff(
    token: string,
  ): Promise<{ ok: true; sessionId: string } | { ok: false; message: string }> {
    const key = `${TELEGRAM_HANDOFF_PREFIX}${token.trim()}`;
    const sessionId = await this.redis.get(key);
    if (!sessionId) {
      return { ok: false, message: "로그인 연결이 만료되었습니다. 다시 시도해 주세요." };
    }
    await this.redis.del(key);

    const session = await this.sessions.findValid(sessionId);
    if (!session) {
      return { ok: false, message: "세션이 만료되었습니다. 다시 로그인해 주세요." };
    }

    return { ok: true, sessionId };
  }

  private async fetchGoogleProfile(code: string): Promise<GoogleUserInfo> {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: config.googleClientId,
        client_secret: config.googleClientSecret,
        redirect_uri: config.googleRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenBody = (await tokenRes.json()) as GoogleTokenResponse;
    if (!tokenRes.ok || !tokenBody.access_token) {
      throw new Error(tokenBody.error ?? "Google 토큰 교환에 실패했습니다.");
    }

    const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
      headers: { Authorization: `Bearer ${tokenBody.access_token}` },
    });

    if (!userRes.ok) {
      throw new Error("Google 사용자 정보를 가져오지 못했습니다.");
    }

    return (await userRes.json()) as GoogleUserInfo;
  }

  async resolveSession(sessionId: string): Promise<{
    webAccountId: string;
    userId: string | null;
    isAdmin: boolean;
    email: string;
  } | null> {
    const session = await this.sessions.findValid(sessionId);
    if (!session) return null;

    const account = await this.webAccounts.findById(session.webAccountId);
    if (!account) return null;

    const user = await this.users.findByWebAccountId(account.id);

    return {
      webAccountId: account.id,
      userId: user?.id ?? null,
      isAdmin: account.role === "admin",
      email: account.email,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.sessions.delete(sessionId);
  }

  generateInviteCode(): string {
    const segment = randomBytes(4).toString("hex").toUpperCase();
    return `MYOWN-${segment}`;
  }
}
