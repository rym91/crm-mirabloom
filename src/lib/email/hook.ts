import { askText } from "./llm";

export type HookInput = {
  supplierName: string;
  brands: string[];
  country?: string | null;
  notes?: string | null;
  sourceUrl?: string | null;
};

/** One personalized opening sentence for the intro email. Empty string = omit the line. */
export async function generateOpeningHook(
  s: HookInput,
  ask: (prompt: string) => Promise<string> = (p) => askText(p, { timeoutMs: 30_000 })
): Promise<string> {
  if (!s.notes && !s.sourceUrl) return "";
  const prompt = `Write ONE short, factual, polite opening sentence (max 25 words) in English for a wholesale enquiry email to this distributor. No flattery, no exclamation marks. It must reference a concrete fact about THEM.

Distributor: ${s.supplierName}
Country: ${s.country ?? "unknown"}
Brands they distribute: ${s.brands.join(", ") || "unknown"}
What we know: ${s.notes ?? ""} ${s.sourceUrl ?? ""}

Good example: "I see you're the official PILOT distributor for Spain — exactly the kind of partner we're looking for."
If you don't have a concrete fact to reference, answer exactly: SKIP

Answer with the sentence only.`;
  try {
    const out = (await ask(prompt)).trim();
    const line = out.split("\n")[0].trim().replace(/^["'«]+|["'»]+$/g, "").trim();
    if (!line || line.toUpperCase() === "SKIP" || line.length > 220) return "";
    return line;
  } catch {
    return "";
  }
}
