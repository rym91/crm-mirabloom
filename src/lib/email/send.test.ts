import { describe, it, expect, vi } from "vitest";
import { applyTestMode, generateMessageId, sendEmail } from "@/lib/email/send";

type Env = NodeJS.ProcessEnv;

describe("applyTestMode", () => {
  it("defaults to TEST ON when env var missing", () => {
    const r = applyTestMode("real@supplier.com", "Subj", { EMAIL_TEST_RECIPIENT: "me@test.com" } as unknown as Env);
    expect(r).toEqual({ to: "me@test.com", subject: "[TEST → real@supplier.com] Subj", testMode: true });
  });
  it("TEST ON for any value except literal false", () => {
    const r = applyTestMode("a@b.c", "S", { EMAIL_TEST_MODE: "1", EMAIL_TEST_RECIPIENT: "t@t.t" } as unknown as Env);
    expect(r.testMode).toBe(true);
  });
  it("passes through when explicitly false", () => {
    const r = applyTestMode("a@b.c", "S", { EMAIL_TEST_MODE: "false" } as unknown as Env);
    expect(r).toEqual({ to: "a@b.c", subject: "S", testMode: false });
  });
  it("throws when TEST ON but no recipient (fail-safe: nothing can be sent)", () => {
    expect(() => applyTestMode("a@b.c", "S", {} as unknown as Env)).toThrow();
  });
});

describe("generateMessageId", () => {
  it("embeds routingToken before first dot and domain after @", () => {
    const id = generateMessageId("tok123abc", "mirabloom.eu");
    expect(id.startsWith("<tok123abc.")).toBe(true);
    expect(id.endsWith("@mirabloom.eu>")).toBe(true);
  });
});

describe("sendEmail", () => {
  it("sends via injected transport with test-mode substitution", async () => {
    const sendMail = vi.fn().mockResolvedValue({ accepted: ["me@test.com"] });
    const res = await sendEmail(
      { to: "real@supplier.com", subject: "Hello", text: "body", messageId: "<tok.1@mirabloom.eu>" },
      { EMAIL_TEST_RECIPIENT: "me@test.com", SMTP_PASS: "x", MAIL_FROM: "T <hello@mirabloom.eu>", SMTP_USER: "hello@mirabloom.eu" } as unknown as Env,
      () => ({ sendMail }) as never
    );
    expect(res).toEqual({ ok: true, usedTo: "me@test.com", testMode: true });
    expect(sendMail).toHaveBeenCalledWith(expect.objectContaining({
      to: "me@test.com",
      subject: "[TEST → real@supplier.com] Hello",
      messageId: "<tok.1@mirabloom.eu>",
      from: "T <hello@mirabloom.eu>",
    }));
  });
  it("refuses real send without SMTP_PASS", async () => {
    const res = await sendEmail(
      { to: "a@b.c", subject: "S", text: "t", messageId: "<x.1@d>" },
      { EMAIL_TEST_MODE: "false" } as unknown as Env,
      () => { throw new Error("must not create transport"); }
    );
    expect(res.ok).toBe(false);
  });
});
