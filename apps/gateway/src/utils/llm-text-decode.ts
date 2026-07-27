/**
 * 일부 로컬 LLM이 한글 등을 `<0xEC><0xAE><0xB8>` 형태 UTF-8 바이트로 내보낼 때 복원.
 */
export function decodeLlmUtf8Escapes(text: string): string {
  if (!text.includes("<0x") && !text.includes("<0X")) return text;

  return text.replace(/(?:<0x[0-9A-Fa-f]{2}>)+/gi, (chunk) => {
    const bytes: number[] = [];
    for (const match of chunk.matchAll(/<0x([0-9A-Fa-f]{2})>/gi)) {
      bytes.push(Number.parseInt(match[1]!, 16));
    }
    if (bytes.length === 0) return chunk;
    try {
      return Buffer.from(bytes).toString("utf8");
    } catch {
      return chunk;
    }
  });
}

export function decodeLlmStringFields<T extends object>(args: T): T {
  const next = { ...args } as T & Record<string, unknown>;
  for (const [key, value] of Object.entries(next)) {
    if (typeof value === "string") {
      next[key] = decodeLlmUtf8Escapes(value);
    }
  }
  return next;
}
