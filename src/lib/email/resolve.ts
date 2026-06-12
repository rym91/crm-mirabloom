export function extractMessageIds(...headers: (string | null | undefined)[]): string[] {
  return headers.filter(Boolean).join(" ").match(/<[^<>\s]+>/g) ?? [];
}

/** Our Message-IDs look like <routingToken.rand@domain>; token = part before the first dot. */
export function extractRoutingToken(inReplyTo?: string | null, references?: string | null): string | null {
  for (const id of extractMessageIds(inReplyTo, references)) {
    const m = id.match(/^<([a-z0-9]+)\.[a-z0-9]+@/i);
    if (m) return m[1];
  }
  return null;
}

export function normalizeSubject(s: string): string {
  let out = s.trim();
  for (;;) {
    const next = out.replace(/^(re|fw|fwd|aw|ответ)\s*:\s*/i, "");
    if (next === out) break;
    out = next;
  }
  return out.toLowerCase().trim();
}
