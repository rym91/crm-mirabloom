import { describe, it, expect } from "vitest";
import { nextFollowUp, addDays } from "@/lib/email/sequence";

describe("nextFollowUp", () => {
  it("after intro (0 sent) -> FU1 at +3d", () =>
    expect(nextFollowUp(0)).toEqual({ step: 1, afterDays: 3, kind: "FOLLOWUP_1" }));
  it("after FU1 (1 sent) -> FU2 at +7d", () =>
    expect(nextFollowUp(1)).toEqual({ step: 2, afterDays: 7, kind: "FOLLOWUP_2" }));
  it("after FU2 -> stop", () => expect(nextFollowUp(2)).toBeNull());
});

describe("addDays", () => {
  it("adds days", () =>
    expect(addDays(new Date("2026-06-11T10:00:00Z"), 3).toISOString()).toBe("2026-06-14T10:00:00.000Z"));
});
