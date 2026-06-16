import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type AskOptions = { system?: string; timeoutMs?: number };

/** Thrown (fast, no network) when no working AI provider is configured.
 *  Callers (classify/hook) catch it and fall back to the manual-review path. */
export class AIDisabledError extends Error {
  constructor() {
    super("AI provider disabled (AI_PROVIDER=off or unset)");
    this.name = "AIDisabledError";
  }
}

type Provider = "anthropic" | "agent-sdk" | "off";

/** Pick the AI backend.
 *  - explicit AI_PROVIDER wins ("anthropic" | "agent-sdk" | "off")
 *  - else: ANTHROPIC_API_KEY present → official API
 *  - else: CLAUDE_CODE_OAUTH_TOKEN present → Agent SDK (subscription)
 *  - else: local dev default → Agent SDK (uses local Claude Code login)
 *  NB: the Agent SDK spawns the `claude` CLI and is unreliable in a headless
 *  container, so on the server set AI_PROVIDER=anthropic (API key) or =off. */
function resolveProvider(): Provider {
  const p = (process.env.AI_PROVIDER || "").trim().toLowerCase();
  if (p === "anthropic" || p === "agent-sdk" || p === "off") return p;
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "agent-sdk";
}

const MODEL_MAP: Record<string, string> = {
  haiku: "claude-haiku-4-5",
  sonnet: "claude-sonnet-4-6",
  opus: "claude-opus-4-8",
};

/** Resolve a full Anthropic model id. LLM_MODEL_ID wins; else map the short
 *  LLM_MODEL alias ("haiku"/"sonnet"/"opus"); a full id in LLM_MODEL passes through.
 *  Default = haiku (cheap, plenty for classification). */
function anthropicModelId(): string {
  if (process.env.LLM_MODEL_ID) return process.env.LLM_MODEL_ID;
  const m = (process.env.LLM_MODEL || "haiku").trim().toLowerCase();
  return MODEL_MAP[m] || m;
}

/** Reject after timeoutMs no matter what the underlying provider does. */
function withTimeout<T>(p: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new Error("LLM timeout")), timeoutMs);
    }),
  ]).finally(() => clearTimeout(timer)) as Promise<T>;
}

/** Official Anthropic API (paid key). Robust in a headless container. */
async function askAnthropic(prompt: string, opts: AskOptions, timeoutMs: number): Promise<string> {
  const { default: Anthropic } = await import("@anthropic-ai/sdk");
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    timeout: timeoutMs,
    maxRetries: 1,
  });
  const msg = await client.messages.create(
    {
      model: anthropicModelId(),
      max_tokens: 1024,
      ...(opts.system ? { system: opts.system } : {}),
      messages: [{ role: "user", content: prompt }],
    },
    { timeout: timeoutMs },
  );
  const text = (msg.content || [])
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("LLM returned empty result");
  return text;
}

/** Type guard for Agent-SDK result messages */
function isResultMsg(msg: SDKMessage): msg is SDKMessage & { type: "result"; subtype: string; result?: string } {
  return (msg as { type?: string }).type === "result";
}

/** Agent SDK (subscription auth — local Claude Code login, or CLAUDE_CODE_OAUTH_TOKEN). */
async function askAgentSdk(prompt: string, opts: AskOptions): Promise<string> {
  let out = "";
  for await (const msg of query({
    prompt,
    options: {
      model: process.env.LLM_MODEL || "sonnet",
      maxTurns: 1,
      allowedTools: [],
      settingSources: [],
      ...(opts.system ? { systemPrompt: opts.system } : {}),
    },
  })) {
    if (isResultMsg(msg)) {
      if (msg.subtype === "success") {
        out = (msg as unknown as { result: string }).result;
      } else {
        throw new Error(`LLM result: ${msg.subtype}`);
      }
    }
  }
  if (!out.trim()) throw new Error("LLM returned empty result");
  return out;
}

/** One-shot text question to Claude. No tools, single turn. Never hangs past timeoutMs. */
export async function askText(prompt: string, opts: AskOptions = {}): Promise<string> {
  const provider = resolveProvider();
  if (provider === "off") throw new AIDisabledError();
  const timeoutMs = opts.timeoutMs ?? 60_000;
  if (provider === "anthropic") return withTimeout(askAnthropic(prompt, opts, timeoutMs), timeoutMs);
  return withTimeout(askAgentSdk(prompt, opts), timeoutMs);
}

export function extractJson(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const raw = fenced ? fenced[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) throw new Error("no JSON object in LLM output");
  return JSON.parse(raw.slice(start, end + 1));
}

export async function askJson(prompt: string, opts: AskOptions = {}): Promise<unknown> {
  return extractJson(await askText(prompt, opts));
}
