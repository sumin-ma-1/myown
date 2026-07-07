import type { TaskPriority } from "@myown/database";
import type OpenAI from "openai";
import { parseDateAndTime } from "../utils/datetime-parse.js";

export const agentTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "새 업무를 등록합니다.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "업무 제목" },
          description: { type: "string", description: "상세 설명" },
          due_date: {
            type: "string",
            description: "마감일 (YYYY-MM-DD). 없으면 생략",
          },
          due_time: {
            type: "string",
            description: "마감 시각 (HH:MM, 24시간). 없으면 날짜만",
          },
          priority: {
            type: "string",
            enum: ["urgent", "high", "medium"],
            description: "최우선(urgent), 우선(high), 일반(medium). 생략 시 일반",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_reminder",
      description: "특정 업무에 지정 시각 알림을 추가합니다.",
      parameters: {
        type: "object",
        properties: {
          list_index: { type: "number", description: "/list 활성 목록 순번 (1=첫 줄)" },
          remind_date: {
            type: "string",
            description: "알림 날짜 YYYY-MM-DD. 생략 시 오늘",
          },
          remind_time: {
            type: "string",
            description: "알림 시각 HH:MM (24시간). remind_in_minutes와 둘 중 하나",
          },
          remind_in_minutes: {
            type: "number",
            description: "몇 분 후 알림 (예: 5, 30). remind_time과 둘 중 하나",
          },
        },
        required: ["list_index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "complete_task",
      description: "업무를 완료 처리합니다.",
      parameters: {
        type: "object",
        properties: {
          list_index: { type: "number", description: "/list 활성 목록 순번 (1=첫 줄)" },
          title: { type: "string", description: "제목 일부로 검색" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_tasks",
      description: "활성 업무 목록을 조회합니다.",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "list_today_tasks",
      description: "오늘 마감 업무를 조회합니다.",
      parameters: { type: "object", properties: {} },
    },
  },
];

export interface CreateTaskArgs {
  title: string;
  description?: string;
  due_date?: string;
  due_time?: string;
  priority?: TaskPriority;
}

export interface CreateReminderArgs {
  list_index: number;
  remind_date?: string;
  remind_time?: string;
  remind_in_minutes?: number;
}

export interface CompleteTaskArgs {
  list_index?: number;
  title?: string;
}

export function resolveDueAt(due_date?: string, due_time?: string) {
  return parseDateAndTime(due_date, due_time);
}
