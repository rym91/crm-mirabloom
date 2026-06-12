import { describe, it, expect, vi } from "vitest";
import { classifyInbound } from "@/lib/email/classify";

const input = { subject: "Re: Wholesale", bodyText: "Please find our price list attached.", attachmentNames: ["prices2026.xlsx"] };

describe("classifyInbound", () => {
  it("maps a valid LLM answer", async () => {
    const ask = vi.fn().mockResolvedValue({ class: "PRICE_LIST", confidence: 0.93, summary: "Прислали прайс" });
    expect(await classifyInbound(input, ask)).toEqual({ class: "PRICE_LIST", confidence: 0.93, summary: "Прислали прайс" });
  });
  it("invalid class falls back to OTHER, keeps confidence 0", async () => {
    const ask = vi.fn().mockResolvedValue({ class: "BANANA", confidence: 2, summary: 5 });
    expect(await classifyInbound(input, ask)).toEqual({ class: "OTHER", confidence: 0, summary: "" });
  });
  it("LLM error -> fail-safe OTHER/0", async () => {
    const ask = vi.fn().mockRejectedValue(new Error("boom"));
    expect(await classifyInbound(input, ask)).toEqual({ class: "OTHER", confidence: 0, summary: "" });
  });
});
