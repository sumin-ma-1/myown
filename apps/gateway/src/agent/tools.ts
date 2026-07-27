import type { TaskPriority } from "@myown/database";
import type OpenAI from "openai";
import { parseDateAndTime } from "../utils/datetime-parse.js";
import type { DraftReminderConfig } from "../services/draft-reminder.js";

const reminderConfigProperties = {
  type: "object",
  description:
    "이 업무 알림 의도. 없으면 사용자 기본 D-DAY. 알림 없음: use_default_reminders=false. 특정 시각만: use_default_reminders=false + absolute_times. 마감 기준 하나만: use_default_reminders=false + extra_rules(예 days_before:0)",
  properties: {
    use_default_reminders: {
      type: "boolean",
      description: "기본 D-DAY 알림 사용 여부. false면 기본 알림 안 함",
    },
    extra_rules: {
      type: "array",
      description: "마감 기준 상대 알림",
      items: {
        type: "object",
        properties: {
          days_before: { type: "number", description: "마감 N일 전 (0=당일)" },
          hours_before: { type: "number", description: "마감 N시간 전" },
          minutes_before: { type: "number", description: "마감 N분 전" },
        },
      },
    },
    absolute_times: {
      type: "array",
      description: "절대 시각 알림 (언제만)",
      items: {
        type: "object",
        properties: {
          date: { type: "string", description: "YYYY-MM-DD. 생략 시 오늘" },
          time: { type: "string", description: "HH:MM" },
        },
        required: ["time"],
      },
    },
  },
} as const;

export const agentTools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "create_task",
      description: "새 업무 초안을 만듭니다. 알림 의도가 있으면 reminder_config를 넣으세요.",
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
          reminder_config: reminderConfigProperties,
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
      name: "list_reminders",
      description: "특정 활성 업무의 예약(pending) 알림 목록을 조회합니다.",
      parameters: {
        type: "object",
        properties: {
          list_index: { type: "number", description: "활성 목록 순번 (1=첫 줄)" },
        },
        required: ["list_index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "cancel_reminder",
      description: "특정 업무의 예약 알림을 취소합니다. reminder_index는 list_reminders 순번.",
      parameters: {
        type: "object",
        properties: {
          list_index: { type: "number", description: "활성 업무 순번" },
          reminder_index: {
            type: "number",
            description: "list_reminders의 알림 순번 (1=첫 줄). 생략 시 해당 업무 pending 전부 취소",
          },
        },
        required: ["list_index"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_task_reminders",
      description:
        "이미 등록된 업무의 알림을 reminder_config로 다시 맞춥니다. 기본/상대/절대 시각을 한 번에 설정.",
      parameters: {
        type: "object",
        properties: {
          list_index: { type: "number", description: "활성 업무 순번" },
          reminder_config: reminderConfigProperties,
        },
        required: ["list_index", "reminder_config"],
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
  reminder_config?: DraftReminderConfig | Record<string, unknown>;
  reminderConfig?: DraftReminderConfig | Record<string, unknown>;
  use_default_reminders?: boolean;
  extra_rules?: unknown[];
  absolute_times?: unknown[];
}

export interface CreateReminderArgs {
  list_index: number;
  remind_date?: string;
  remind_time?: string;
  remind_in_minutes?: number;
}

export interface ListRemindersArgs {
  list_index: number;
}

export interface CancelReminderArgs {
  list_index: number;
  reminder_index?: number;
}

export interface SetTaskRemindersArgs {
  list_index: number;
  reminder_config?: DraftReminderConfig | Record<string, unknown>;
  reminderConfig?: DraftReminderConfig | Record<string, unknown>;
  use_default_reminders?: boolean;
  extra_rules?: unknown[];
  absolute_times?: unknown[];
}

export interface CompleteTaskArgs {
  list_index?: number;
  title?: string;
}

export function resolveDueAt(due_date?: string, due_time?: string) {
  return parseDateAndTime(due_date, due_time);
}
