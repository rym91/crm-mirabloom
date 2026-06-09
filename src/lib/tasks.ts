import type { TaskKind } from "@prisma/client";

export type DayGroup = "overdue" | "today" | "noDate" | "later";

type DayInput = { dueAt: Date | null; status: string };

function startOfDay(d: Date): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function groupTaskByDay(task: DayInput, now: Date): DayGroup {
  if (!task.dueAt) return "noDate";
  const due = startOfDay(task.dueAt);
  const today = startOfDay(now);
  if (due < today) return task.status !== "DONE" ? "overdue" : "later";
  if (due === today) return "today";
  return "later";
}

export function groupTasksByDay<T extends DayInput>(tasks: T[], now: Date) {
  const groups: Record<DayGroup, T[]> = { overdue: [], today: [], noDate: [], later: [] };
  for (const t of tasks) groups[groupTaskByDay(t, now)].push(t);
  return groups;
}

export function tagManagerTaskTitle(kind: TaskKind, supplierName: string): string {
  if (kind === "PRICE_REVIEW") return `Обработать прайс — ${supplierName}`;
  if (kind === "MANUAL_REVIEW") return `Проверить ответ — ${supplierName}`;
  return `Задача — ${supplierName}`;
}

export function buildTaggedTaskData(input: {
  kind: TaskKind;
  supplierId: string;
  supplierName: string;
  managerId: string;
}) {
  return {
    title: tagManagerTaskTitle(input.kind, input.supplierName),
    assigneeId: input.managerId,
    kind: input.kind,
    status: "TODO" as const,
    entityType: "SUPPLIER" as const,
    entityId: input.supplierId,
  };
}