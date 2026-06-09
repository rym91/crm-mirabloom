import { describe, it, expect } from "vitest";
import { SupplierStatus, TaskKind } from "@prisma/client";

describe("enum members for Layer 1", () => {
  it("SupplierStatus has MANUAL_REVIEW", () => {
    expect(SupplierStatus.MANUAL_REVIEW).toBe("MANUAL_REVIEW");
  });
  it("TaskKind has the three kinds", () => {
    expect(TaskKind.GENERIC).toBe("GENERIC");
    expect(TaskKind.PRICE_REVIEW).toBe("PRICE_REVIEW");
    expect(TaskKind.MANUAL_REVIEW).toBe("MANUAL_REVIEW");
  });
});