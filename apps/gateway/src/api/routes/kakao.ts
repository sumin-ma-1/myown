import { Hono } from "hono";
import type { ApiEnv } from "../types.js";
import { isKakaoEnabled } from "../../config.js";
import type { KakaoSkillRequest } from "../../kakao/types.js";
import { handleKakaoSkill } from "../../kakao/skill-handler.js";
import { kakaoTextResponse } from "../../kakao/response.js";

export const kakaoRoute = new Hono<ApiEnv>();

kakaoRoute.post("/skill", async (c) => {
  if (!isKakaoEnabled()) {
    return c.json(kakaoTextResponse("카카오 연동이 설정되지 않았습니다."), 503);
  }

  let body: KakaoSkillRequest;
  try {
    body = await c.req.json<KakaoSkillRequest>();
  } catch {
    return c.json(kakaoTextResponse("잘못된 요청입니다."), 400);
  }

  try {
    const response = await handleKakaoSkill(c.get("app"), body);
    return c.json(response);
  } catch (err) {
    console.error("[kakao] skill route error:", err);
    return c.json(kakaoTextResponse("⚠️ 서버 오류가 발생했습니다."), 500);
  }
});
