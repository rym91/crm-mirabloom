import { askJson } from "./llm";

export type InboundClass = "PRICE_LIST" | "QUESTION" | "REJECTION" | "OTHER";
export type Classification = { class: InboundClass; confidence: number; summary: string };

const CLASSES: InboundClass[] = ["PRICE_LIST", "QUESTION", "REJECTION", "OTHER"];
const FALLBACK: Classification = { class: "OTHER", confidence: 0, summary: "" };

export async function classifyInbound(
  input: { subject: string; bodyText: string; attachmentNames?: string[] },
  ask: (prompt: string) => Promise<unknown> = (p) => askJson(p, { timeoutMs: 45_000 })
): Promise<Classification> {
  const prompt = `You are classifying a supplier's email reply for a wholesale-sourcing CRM.

Email subject: ${input.subject}
Attachments: ${input.attachmentNames?.length ? input.attachmentNames.join(", ") : "(none)"}
Email body:
"""
${input.bodyText.slice(0, 6000)}
"""

Classify the reply into exactly one class:
- PRICE_LIST: they sent or attached a price list / catalogue / wholesale terms (an attached .xlsx/.pdf named like a price list counts).
- QUESTION: they ask us something or request documents before proceeding.
- REJECTION: they decline (no wholesale, no Amazon resellers, not taking new clients).
- OTHER: anything else (auto-reply, forwarding, unclear).

Answer with ONLY a JSON object: {"class": "...", "confidence": 0.0-1.0, "summary": "одно-два предложения по-русски, что ответил поставщик"}`;
  try {
    const res = (await ask(prompt)) as Partial<Classification> & { class?: string };
    const cls = CLASSES.includes(res.class as InboundClass) ? (res.class as InboundClass) : "OTHER";
    const conf = typeof res.confidence === "number" && res.confidence >= 0 && res.confidence <= 1 ? res.confidence : 0;
    const summary = typeof res.summary === "string" ? res.summary.slice(0, 500) : "";
    if (cls === "OTHER" && conf === 0) return { ...FALLBACK, summary };
    return { class: cls, confidence: conf, summary };
  } catch {
    return FALLBACK;
  }
}
