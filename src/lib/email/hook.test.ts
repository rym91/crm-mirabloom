import { describe, it, expect, vi } from "vitest";
import { generateOpeningHook } from "@/lib/email/hook";

describe("generateOpeningHook", () => {
  it("returns empty WITHOUT calling LLM when no notes and no sourceUrl", async () => {
    const ask = vi.fn();
    expect(await generateOpeningHook({ supplierName: "X", brands: ["PILOT"] }, ask)).toBe("");
    expect(ask).not.toHaveBeenCalled();
  });
  it("returns trimmed single line", async () => {
    const ask = vi.fn().mockResolvedValue('  "I see you are the official PILOT distributor for Spain."  \nsecond line');
    expect(await generateOpeningHook({ supplierName: "X", brands: ["PILOT"], notes: "official distributor" }, ask))
      .toBe("I see you are the official PILOT distributor for Spain.");
  });
  it("SKIP -> empty", async () => {
    const ask = vi.fn().mockResolvedValue("SKIP");
    expect(await generateOpeningHook({ supplierName: "X", brands: [], notes: "n" }, ask)).toBe("");
  });
  it("LLM error -> empty (never blocks draft)", async () => {
    const ask = vi.fn().mockRejectedValue(new Error("x"));
    expect(await generateOpeningHook({ supplierName: "X", brands: [], notes: "n" }, ask)).toBe("");
  });
  it("overlong output -> empty", async () => {
    const ask = vi.fn().mockResolvedValue("a".repeat(300));
    expect(await generateOpeningHook({ supplierName: "X", brands: [], notes: "n" }, ask)).toBe("");
  });
});
