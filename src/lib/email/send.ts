import nodemailer, { type Transporter } from "nodemailer";

export type SendEmailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  messageId: string;
  inReplyTo?: string;
  references?: string;
};
export type SendEmailResult =
  | { ok: true; usedTo: string; testMode: boolean }
  | { ok: false; error: string };

/** TEST MODE is ON unless the env var is the literal string "false" (fail-safe default). */
export function applyTestMode(
  to: string,
  subject: string,
  env: NodeJS.ProcessEnv = process.env
): { to: string; subject: string; testMode: boolean } {
  const testMode = env.EMAIL_TEST_MODE !== "false";
  if (!testMode) return { to, subject, testMode };
  const recipient = env.EMAIL_TEST_RECIPIENT;
  if (!recipient) throw new Error("EMAIL_TEST_MODE is on but EMAIL_TEST_RECIPIENT is not set");
  return { to: recipient, subject: `[TEST → ${to}] ${subject}`, testMode: true };
}

export function generateMessageId(
  routingToken: string,
  domain = (process.env.SMTP_USER ?? "crm@local").split("@")[1]
): string {
  const rand = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `<${routingToken}.${rand}@${domain}>`;
}

function defaultTransport(env: NodeJS.ProcessEnv): Transporter {
  return nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: Number(env.SMTP_PORT ?? 465),
    secure: Number(env.SMTP_PORT ?? 465) === 465,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
  });
}

export async function sendEmail(
  input: SendEmailInput,
  env: NodeJS.ProcessEnv = process.env,
  makeTransport: (env: NodeJS.ProcessEnv) => Transporter = defaultTransport
): Promise<SendEmailResult> {
  try {
    const { to, subject, testMode } = applyTestMode(input.to, input.subject, env);
    if (!env.SMTP_PASS) return { ok: false, error: "SMTP_PASS is not set" };
    const transport = makeTransport(env);
    const unsub = env.MAIL_UNSUBSCRIBE || env.SMTP_USER || "";
    await transport.sendMail({
      messageId: input.messageId,
      from: env.MAIL_FROM ?? env.SMTP_USER,
      to,
      replyTo: env.SMTP_USER,
      subject,
      text: input.text,
      html: input.html,
      inReplyTo: input.inReplyTo || undefined,
      references: input.references || undefined,
      headers: unsub ? { "List-Unsubscribe": `<mailto:${unsub}?subject=unsubscribe>` } : undefined,
    });
    return { ok: true, usedTo: to, testMode };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}
