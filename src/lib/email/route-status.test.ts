import { describe, it, expect } from "vitest";
import {
  isManualLocked, nextStatusOnSend, nextStatusOnReply, nextStatusFromClassification,
  PRICE_CONFIDENCE_THRESHOLD,
} from "@/lib/email/route-status";

describe("manual lock", () => {
  it.each(["NEGOTIATING", "ACTIVE", "ON_HOLD", "REJECTED"] as const)("%s is locked", (s) => {
    expect(isManualLocked(s)).toBe(true);
    expect(nextStatusOnSend(s)).toBeNull();
    expect(nextStatusOnReply(s)).toBeNull();
    expect(nextStatusFromClassification(s, "PRICE_LIST", 0.99)).toBeNull();
  });
});

describe("nextStatusOnSend", () => {
  it("CANDIDATE -> CONTACTED", () => expect(nextStatusOnSend("CANDIDATE")).toBe("CONTACTED"));
  it("QUALIFIED -> CONTACTED", () => expect(nextStatusOnSend("QUALIFIED")).toBe("CONTACTED"));
  it("CONTACTED stays (no change)", () => expect(nextStatusOnSend("CONTACTED")).toBeNull());
  it("REPLIED is never demoted", () => expect(nextStatusOnSend("REPLIED")).toBeNull());
  it("QUOTED is never demoted", () => expect(nextStatusOnSend("QUOTED")).toBeNull());
});

describe("nextStatusOnReply", () => {
  it("CONTACTED -> REPLIED", () => expect(nextStatusOnReply("CONTACTED")).toBe("REPLIED"));
  it("CANDIDATE -> REPLIED (reply before we logged send)", () => expect(nextStatusOnReply("CANDIDATE")).toBe("REPLIED"));
  it("QUOTED stays", () => expect(nextStatusOnReply("QUOTED")).toBeNull());
  it("MANUAL_REVIEW stays (classification decides)", () => expect(nextStatusOnReply("MANUAL_REVIEW")).toBeNull());
});

describe("nextStatusFromClassification", () => {
  it("price list above threshold -> QUOTED", () =>
    expect(nextStatusFromClassification("REPLIED", "PRICE_LIST", PRICE_CONFIDENCE_THRESHOLD)).toBe("QUOTED"));
  it("price list below threshold -> MANUAL_REVIEW", () =>
    expect(nextStatusFromClassification("REPLIED", "PRICE_LIST", 0.5)).toBe("MANUAL_REVIEW"));
  it("question -> MANUAL_REVIEW", () =>
    expect(nextStatusFromClassification("REPLIED", "QUESTION", 0.95)).toBe("MANUAL_REVIEW"));
  it("rejection -> MANUAL_REVIEW (no auto-reject in MVP)", () =>
    expect(nextStatusFromClassification("REPLIED", "REJECTION", 0.99)).toBe("MANUAL_REVIEW"));
  it("already QUOTED never demoted by a follow-up question", () =>
    expect(nextStatusFromClassification("QUOTED", "QUESTION", 0.9)).toBeNull());
  it("already QUOTED + another price list -> no-op", () =>
    expect(nextStatusFromClassification("QUOTED", "PRICE_LIST", 0.9)).toBeNull());
  it("already MANUAL_REVIEW + OTHER -> no-op", () =>
    expect(nextStatusFromClassification("MANUAL_REVIEW", "OTHER", 0)).toBeNull());
  it("MANUAL_REVIEW + confident price -> QUOTED (upgrade allowed)", () =>
    expect(nextStatusFromClassification("MANUAL_REVIEW", "PRICE_LIST", 0.9)).toBe("QUOTED"));
});
