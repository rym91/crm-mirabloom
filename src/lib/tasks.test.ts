import { describe, it, expect } from "vitest";
import { groupTaskByDay, groupTasksByDay, tagManagerTaskTitle, buildTaggedTaskData } from "@/lib/tasks";

const now = new Date("2026-06-09T12:00:00Z");

describe("groupTaskByDay", () => {
  it("no due date -> noDate", () => {
    expect(groupTaskByDay({ dueAt: null, status: "TODO" }, now)).toBe("noDate");
  });
  it("past due and not done -> overdue", () => {
    expect(groupTaskByDay({ dueAt: new Date("2026-06-07T00:00:00Z"), status: "TODO" }, now)).toBe("overdue");
  });
  it("past due but DONE -> later (not overdue)", () => {
    expect(groupTaskByDay({ dueAt: new Date("2026-06-07T00:00:00Z"), status: "DONE" }, now)).toBe("later");
  });
  it("due today -> today", () => {
    expect(groupTaskByDay({ dueAt: new Date("2026-06-09T20:00:00Z"), status: "TODO" }, now)).toBe("today");
  });
  it("future -> later", () => {
    expect(groupTaskByDay({ dueAt: new Date("2026-06-15T00:00:00Z"), status: "TODO" }, now)).toBe("later");
  });
});

describe("groupTasksByDay", () => {
  it("splits a list into the four buckets", () => {
    const tasks = [
      { dueAt: null, status: "TODO" as const },
      { dueAt: new Date("2026-06-07T00:00:00Z"), status: "TODO" as const },
      { dueAt: new Date("2026-06-09T08:00:00Z"), status: "TODO" as const },
      { dueAt: new Date("2026-06-20T00:00:00Z"), status: "TODO" as const },
    ];
    const g = groupTasksByDay(tasks, now);
    expect(g.noDate).toHaveLength(1);
    expect(g.overdue).toHaveLength(1);
    expect(g.today).toHaveLength(1);
    expect(g.later).toHaveLength(1);
  });
});

describe("tagManagerTaskTitle", () => {
  it("PRICE_REVIEW", () => {
    expect(tagManagerTaskTitle("PRICE_REVIEW", "PILOT")).toBe("Обработать прайс — PILOT");
  });
  it("MANUAL_REVIEW", () => {
    expect(tagManagerTaskTitle("MANUAL_REVIEW", "Kaweco")).toBe("Проверить ответ — Kaweco");
  });
  it("GENERIC", () => {
    expect(tagManagerTaskTitle("GENERIC", "X")).toBe("Задача — X");
  });
});

describe("buildTaggedTaskData", () => {
  it("builds an assigned PRICE_REVIEW task linked to the supplier", () => {
    const d = buildTaggedTaskData({ kind: "PRICE_REVIEW", supplierId: "sup1", supplierName: "PILOT", managerId: "u1" });
    expect(d).toEqual({
      title: "Обработать прайс — PILOT",
      assigneeId: "u1",
      kind: "PRICE_REVIEW",
      status: "TODO",
      entityType: "SUPPLIER",
      entityId: "sup1",
    });
  });
});