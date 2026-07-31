import type { Redis } from "ioredis";
import type { ComposeDraft, ComposeMode } from "../telegram/compose-session.js";
import type { DraftReminderConfig } from "./draft-reminder.js";

const TTL_SEC = 30 * 60;
const key = (userId: string) => `web-compose:${userId}`;

export interface WebComposeState {
  mode: ComposeMode;
  draft: ComposeDraft;
}

interface StoredDraft {
  attachmentIds: string[];
  title: string;
  description?: string | null;
  priority?: ComposeDraft["priority"];
  dueAt?: string | null;
  startsAt?: string | null;
  allDay?: boolean;
  recurrenceRule?: string | null;
  recurrenceUntil?: string | null;
  recurrenceCount?: number | null;
  recurrenceTimezone?: string | null;
  reminderConfig?: DraftReminderConfig;
}

interface StoredState {
  mode: ComposeMode;
  draft: StoredDraft;
}

function serialize(state: WebComposeState): string {
  const payload: StoredState = {
    mode: state.mode,
    draft: {
      ...state.draft,
      dueAt: state.draft.dueAt?.toISOString() ?? null,
      startsAt: state.draft.startsAt?.toISOString() ?? null,
      allDay: state.draft.allDay ?? false,
      recurrenceRule: state.draft.recurrenceRule ?? null,
      recurrenceUntil: state.draft.recurrenceUntil?.toISOString() ?? null,
      recurrenceCount: state.draft.recurrenceCount ?? null,
      recurrenceTimezone: state.draft.recurrenceTimezone ?? null,
    },
  };
  return JSON.stringify(payload);
}

function deserialize(raw: string): WebComposeState {
  const parsed = JSON.parse(raw) as StoredState;
  return {
    mode: parsed.mode,
    draft: {
      ...parsed.draft,
      dueAt: parsed.draft.dueAt ? new Date(parsed.draft.dueAt) : null,
      startsAt: parsed.draft.startsAt ? new Date(parsed.draft.startsAt) : null,
      allDay: parsed.draft.allDay ?? false,
      recurrenceRule: parsed.draft.recurrenceRule ?? null,
      recurrenceUntil: parsed.draft.recurrenceUntil
        ? new Date(parsed.draft.recurrenceUntil)
        : null,
      recurrenceCount: parsed.draft.recurrenceCount ?? null,
      recurrenceTimezone: parsed.draft.recurrenceTimezone ?? null,
      reminderConfig: parsed.draft.reminderConfig,
    },
  };
}

export class WebComposeStore {
  constructor(private readonly redis: Redis) {}

  async get(userId: string): Promise<WebComposeState | null> {
    const raw = await this.redis.get(key(userId));
    if (!raw) return null;
    return deserialize(raw);
  }

  async set(userId: string, state: WebComposeState): Promise<void> {
    await this.redis.set(key(userId), serialize(state), "EX", TTL_SEC);
  }

  async clear(userId: string): Promise<void> {
    await this.redis.del(key(userId));
  }
}
