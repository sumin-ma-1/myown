import type { UserRepository } from "@myown/database";
import { config } from "../config.js";

export async function resolveUserTimezone(
  users: UserRepository,
  userId: string,
): Promise<string> {
  const user = await users.findById(userId);
  return user?.timezone?.trim() || config.timezone;
}
