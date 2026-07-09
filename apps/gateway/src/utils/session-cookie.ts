import { config } from "../config.js";

export function sessionCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: config.webAppUrl.startsWith("https://"),
    sameSite: "Lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}
