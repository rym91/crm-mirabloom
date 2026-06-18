"use server";

import { revalidatePath } from "next/cache";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextStatusOnSend } from "@/lib/email/route-status";
import { createFormTasksCore } from "@/lib/form-tasks";

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await prisma.task.create({ data: { title } });
  revalidatePath("/tasks");
}

export async function assignTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const raw = formData.get("assigneeId");
  await prisma.task.update({ where: { id }, data: { assigneeId: String(raw ?? "") || null } });
  revalidatePath("/tasks");
}

export async function deleteTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  if (!id) return;
  await prisma.task.delete({ where: { id } });
  revalidatePath("/tasks");
}

export async function moveTask(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(status in TaskStatus)) return;
  const task = await prisma.task.update({ where: { id }, data: { status: status as TaskStatus } });

  // Форма заполнена (задача FILL_FORM закрыта) -> поставщик CANDIDATE/QUALIFIED → CONTACTED.
  if (status === "DONE" && task.kind === "FILL_FORM" && task.entityType === "SUPPLIER" && task.entityId) {
    const sup = await prisma.supplier.findUnique({ where: { id: task.entityId } });
    if (sup) {
      const next = nextStatusOnSend(sup.status);
      if (next && next !== sup.status) {
        await prisma.$transaction([
          prisma.supplier.update({ where: { id: sup.id }, data: { status: next } }),
          prisma.note.create({
            data: {
              body: `Авто: B2B-форма заполнена (задача закрыта) → статус ${next}`,
              entityType: "SUPPLIER",
              entityId: sup.id,
            },
          }),
        ]);
        revalidatePath(`/suppliers/${sup.id}`);
      }
    }
  }
  revalidatePath("/tasks");
  revalidatePath("/pipeline");
}

/** Bulk: создать задачи FILL_FORM + тег outreach:form для form-only поставщиков (общее ядро). */
export async function createFormTasks(): Promise<void> {
  await createFormTasksCore();
  revalidatePath("/tasks");
  revalidatePath("/pipeline");
}
