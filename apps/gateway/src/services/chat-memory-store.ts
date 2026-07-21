import type { Redis } from "ioredis";

const TTL_SEC = 30 * 60;
const MAX_TURNS = 8;
const key = (userId: string) => `chat-memory:${userId}`;

export type ChatTurnRole = "user" | "assistant";

export interface ChatTurn {
  role: ChatTurnRole;
  text: string;
}

interface StoredMemory {
  turns: ChatTurn[];
}

export class ChatMemoryStore {
  constructor(private readonly redis: Redis) {}

  async getTurns(userId: string): Promise<ChatTurn[]> {
    const raw = await this.redis.get(key(userId));
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw) as StoredMemory;
      return Array.isArray(parsed.turns) ? parsed.turns : [];
    } catch {
      return [];
    }
  }

  async appendTurns(userId: string, turns: ChatTurn[]): Promise<void> {
    if (turns.length === 0) return;
    const existing = await this.getTurns(userId);
    const next = [...existing, ...turns]
      .map((t) => ({
        role: t.role,
        text: t.text.trim(),
      }))
      .filter((t) => t.text.length > 0)
      .slice(-MAX_TURNS);

    await this.redis.set(key(userId), JSON.stringify({ turns: next } satisfies StoredMemory), "EX", TTL_SEC);
  }

  async clear(userId: string): Promise<void> {
    await this.redis.del(key(userId));
  }
}
