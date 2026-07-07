import type OpenAI from "openai";
import type { TaskPriority } from "@myown/database";

export const composeMemoTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "fill_task_from_memo",
    description: "첨부 업무 등록 중 사용자 메모를 업무 필드로 정리합니다.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "업무 제목 (간결하게)" },
        description: { type: "string", description: "상세 설명·메모" },
        due_date: {
          type: "string",
          description: "마감일 YYYY-MM-DD. 메모에 없으면 생략",
        },
        due_time: {
          type: "string",
          description: "마감 시각 HH:MM (24시간). 날짜만 있으면 생략",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium"],
          description: "최우선(urgent), 우선(high), 일반(medium). 없으면 생략",
        },
      },
      required: ["title"],
    },
  },
};

export interface ComposeMemoArgs {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: TaskPriority;
}
