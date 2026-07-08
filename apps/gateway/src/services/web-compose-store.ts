import type { Redis } from "ioredis";
import type { ComposeDraft, ComposeMode } from "../telegram/compose-session.js";

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
