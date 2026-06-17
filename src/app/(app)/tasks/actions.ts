"use server";

import { revalidatePath } from "next/cache";
import { TaskStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { nextStatusOnSend } from "@/lib/email/route-status";
import { FORM_TAG, formAlias, formTaskBody } from "@/lib/form-outreach";

export async function createTask(formData: FormData) {
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;
  await prisma.task.create({ data: { title } });
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

/**
 * Bulk: для всех form-only поставщиков (есть contactFormUrl, нет email-контакта, ранняя стадия)
 * проставить тег outreach:form и создать задачу FILL_FORM (если открытой ещё нет).
 */
export async function createFormTasks(): Promise<void> {
  const domain = (process.env.SMTP_USER || "hello@mirabloom.eu").split("@")[1] || "mirabloom.eu";
  const suppliers = await prisma.supplier.findMany({
    where: {
      contactFormUrl: { not: null },
      status: { in: ["CANDIDATE", "QUALIFIED"] },
      contacts: { none: { email: { not: null } } },
    },
    include: { brands: { include: { brand: { select: { name: true } } } } },
  });
  const tag = await prisma.tag.upsert({ where: { name: FORM_TAG }, update: {}, create: { name: FORM_TAG } });

  for (const s of suppliers) {
    await prisma.supplierTag.upsert({
      where: { supplierId_tagId: { supplierId: s.id, tagId: tag.id } },
      update: {},
      create: { supplierId: s.id, tagId: tag.id },
    });
    const open = await prisma.task.findFirst({
      where: { kind: "FILL_FORM", entityType: "SUPPLIER", entityId: s.id, status: { not: "DONE" } },
    });
    if (open) continue;
    const brandNames = s.brands.map((b) => b.brand.name);
    await prisma.task.create({
      data: {
        title: `Форма: ${brandNames[0] ?? s.name}`,
        description: formTaskBody(s.name, brandNames, s.contactFormUrl, formAlias(s.id, domain)),
        kind: "FILL_FORM",
        status: "TODO",
        entityType: "SUPPLIER",
        entityId: s.id,
      },
    });
  }
  revalidatePath("/tasks");
  revalidatePath("/pipeline");
}
