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

/**
 * Form-reply alias. For form-only suppliers we have no outgoing Message-ID (no email address,
 * only a web form), so a reply cannot be matched by routingToken. The manager enters
 * `lead-<supplierId>@<domain>` in the brand's form; a catch-all delivers the reply to the
 * monitored mailbox, and we recover the supplierId from the To address here.
 * Returns the supplierId or null.
 */
export function extractSupplierAlias(...tos: (string | null | undefined)[]): string | null {
  const text = tos.filter(Boolean).join(" ");
  for (const addr of text.match(/[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+/g) ?? []) {
    const local = addr.split("@")[0];
    const m = local.match(/^lead-([a-z0-9]+)$/i);
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
