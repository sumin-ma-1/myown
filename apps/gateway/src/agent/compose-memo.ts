import type OpenAI from "openai";
import type { TaskPriority } from "@myown/database";

export const composeMemoTool: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "fill_task_from_memo",
    description: "첨부 업무 등록 중 보충 메모의 의도를 파악해 변경할 필드만 채웁니다.",
    parameters: {
      type: "object",
      properties: {
        title: { type: "string", description: "업무 제목. 메모가 마감·설명 보충만이면 생략" },
        description: { type: "string", description: "상세 설명·메모" },
        due_date: {
          type: "string",
          description: "인스턴스 종료·마감일 YYYY-MM-DD. 메모에 없으면 생략",
        },
        due_time: {
          type: "string",
          description:
            "인스턴스 종료·마감 시각 HH:MM. 날짜만이면 생략. 같은 날 시작~끝이면 start_time과 함께",
        },
        priority: {
          type: "string",
          enum: ["urgent", "high", "medium"],
          description: "최우선(urgent), 우선(high), 일반(medium). 없으면 생략",
        },
        start_date: {
          type: "string",
          description:
            "인스턴스가 여러 날일 때만 시작일. 같은 날이면 생략. 시리즈 기간으로 쓰지 말 것",
        },
        start_time: {
          type: "string",
          description: "인스턴스 시작 시각 HH:MM. 시작~끝 블록에만",
        },
        all_day: {
          type: "boolean",
          description: "종일. 시각 없으면 true",
        },
        recurrence_freq: {
          type: "string",
          enum: ["DAILY", "WEEKLY", "MONTHLY", "YEARLY"],
          description: "시리즈 주기. 반복 의도가 있을 때만",
        },
        recurrence_interval: {
          type: "number",
          description: "시리즈 간격(기본 1)",
        },
        recurrence_until: {
          type: "string",
          description: "시리즈 종료일 YYYY-MM-DD. 인스턴스 due_date와 별개",
        },
        recurrence_count: {
          type: "number",
          description: "시리즈 횟수. until과 택일",
        },
        reminder_config: {
          type: "object",
          description:
            "알림 의도 변경 시만. 알림 없음: use_default_reminders=false. 언제만: absolute_times",
          properties: {
            use_default_reminders: { type: "boolean" },
            extra_rules: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  days_before: { type: "number" },
                  hours_before: { type: "number" },
                  minutes_before: { type: "number" },
                },
              },
            },
            absolute_times: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  date: { type: "string" },
                  time: { type: "string" },
                },
                required: ["time"],
              },
            },
          },
        },
      },
    },
  },
};

export interface ComposeMemoArgs {
  title?: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  start_date?: string;
  start_time?: string;
  all_day?: boolean;
  priority?: TaskPriority;
  recurrence_freq?: "DAILY" | "WEEKLY" | "MONTHLY" | "YEARLY";
  recurrence_interval?: number;
  recurrence_until?: string;
  recurrence_count?: number;
  reminder_config?: Record<string, unknown>;
}
