import { query } from "@anthropic-ai/claude-agent-sdk";
import type { SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export type AskOptions = { system?: string; timeoutMs?: number };

/** Type guard for result messages */
function isResultMsg(msg: SDKMessage): msg is SDKMessage & { type: "result"; subtype: string; result?: string } {
  return (msg as { type?: string }).type === "result";
}

/** One-shot text question to Claude via the Agent SDK (subscription auth — local Claude Code login,
 *  or CLAUDE_CODE_OAUTH_TOKEN on a server). No tools, single turn. */
export async function askText(prompt: string, opts: AskOptions = {}): Promise<string> {
  const timeoutMs = opts.timeoutMs ?? 60_000;
  const run = (async () => {
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
  })();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      run,
      new Promise<never>((_, rej) => { timer = setTimeout(() => rej(new Error("LLM timeout")), timeoutMs); }),
    ]);
  } finally {
    clearTimeout(timer);
  }
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
