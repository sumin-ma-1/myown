const KNOWN_TOOLS = [
  "create_task",
  "create_reminder",
  "complete_task",
  "list_tasks",
  "list_today_tasks",
  "fill_task_from_memo",
] as const;

export type KnownToolName = (typeof KNOWN_TOOLS)[number];

export interface ParsedTextToolCall {
  name: KnownToolName;
  args: Record<string, unknown>;
}

function decodeArgValue(raw: string): unknown {
  const v = raw.trim();
  if (!v) return "";

  const special = v.match(/^<\|"\|>([\s\S]*?)<\|"\|>$/);
  if (special) return special[1]!;

  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }

  if (/^-?\d+$/.test(v)) return Number(v);
  if (/^-?\d+\.\d+$/.test(v)) return Number(v);

  return v;
}

function parseKeyValueArgs(body: string): Record<string, unknown> {
  const args: Record<string, unknown> = {};
  const re =
    /(\w+)\s*:\s*(<\|"\|>[\s\S]*?<\|"\|>|"[^"]*"|'[^']*'|[^,]+)/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(body)) !== null) {
    args[match[1]!] = decodeArgValue(match[2]!);
  }
  return args;
}

function parseArgsBody(body: string): Record<string, unknown> {
  const trimmed = body.trim();
  if (!trimmed) return {};

  if (trimmed.startsWith("{")) {
    try {
      const normalized = trimmed.replace(/<\|"\|>/g, '"');
      return JSON.parse(normalized) as Record<string, unknown>;
    } catch {
      /* key:value 형식으로 폴백 */
    }
  }

  return parseKeyValueArgs(trimmed);
}

function parseSingleToolCall(text: string): ParsedTextToolCall | undefined {
  for (const name of KNOWN_TOOLS) {
    const match = text.match(new RegExp(`^${name}\\s*[({]([\\s\\S]*)[})]\\s*$`));
    if (match) {
      return { name, args: parseArgsBody(match[1]!) };
    }
  }
  return undefined;
}

/** Ollama 등이 content에 도구 호출을 텍스트로 낼 때 파싱 */
export function parseTextToolCalls(
  content: string | null | undefined,
): ParsedTextToolCall[] {
  if (!content?.trim()) return [];

  const trimmed = content.trim();
  const single = parseSingleToolCall(trimmed);
  if (single) return [single];

  const results: ParsedTextToolCall[] = [];
  for (const name of KNOWN_TOOLS) {
    const re = new RegExp(`${name}\\s*[({]([^})]*)[})]`, "g");
    let match: RegExpExecArray | null;
    while ((match = re.exec(trimmed)) !== null) {
      results.push({ name, args: parseArgsBody(match[1]!) });
    }
  }
  return results;
}

export function looksLikeTextToolCall(content: string | null | undefined): boolean {
  return parseTextToolCalls(content).length > 0;
}
