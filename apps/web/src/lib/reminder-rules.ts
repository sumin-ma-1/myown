import type { ExtraReminderRule } from "@/api/types";

function ruleKey(rule: ExtraReminderRule): string {
  return `${rule.daysBefore ?? ""}:${rule.hoursBefore ?? ""}:${rule.minutesBefore ?? ""}`;
}

function normalizeExtraRules(rules: ExtraReminderRule[]): ExtraReminderRule[] {
  return [...rules]
    .map((r) => ({
      ...(r.daysBefore !== undefined ? { daysBefore: r.daysBefore } : {}),
      ...(r.hoursBefore !== undefined ? { hoursBefore: r.hoursBefore } : {}),
      ...(r.minutesBefore !== undefined ? { minutesBefore: r.minutesBefore } : {}),
    }))
    .sort((a, b) => ruleKey(a).localeCompare(ruleKey(b)));
}

export function extraRulesEqual(a: ExtraReminderRule[], b: ExtraReminderRule[]): boolean {
  const left = normalizeExtraRules(a);
  const right = normalizeExtraRules(b);
  if (left.length !== right.length) return false;
  return left.every((rule, index) => ruleKey(rule) === ruleKey(right[index]));
}
