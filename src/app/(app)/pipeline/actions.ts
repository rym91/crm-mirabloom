"use server";

import { revalidatePath } from "next/cache";
import { SupplierStatus, TaskKind, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { requireUser, currentUser } from "@/lib/authz";
import { audit } from "@/lib/audit";
import { bulkIntroCore, type BulkIntroResult } from "@/lib/bulk-intro";
import { buildTaggedTaskData } from "@/lib/tasks";

export async function moveSupplier(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(status in SupplierStatus)) return;
  await prisma.supplier.update({ where: { id }, data: { status: status as SupplierStatus } });
  await audit("supplier.status", { entityType: "SUPPLIER", entityId: id, detail: status });
  revalidatePath("/pipeline");
  revalidatePath(`/suppliers/${id}`);
}

/** Разложить кандидатов: CANDIDATE без email-контакта → QUALIFIED (колонка ручной работы:
 *  найти/добавить email или заполнить форму). Готовые (с email) остаются в CANDIDATE для рассылки. */
export async function triageCandidates(_formData?: FormData): Promise<void> {
  await requireUser();
  const ids = (
    await prisma.supplier.findMany({
      where: { status: "CANDIDATE", optedOut: false, contacts: { none: { email: { not: null } } } },
      select: { id: true },
    })
  ).map((s) => s.id);
  if (ids.length) {
    await prisma.supplier.updateMany({ where: { id: { in: ids } }, data: { status: "QUALIFIED" } });
    await audit("supplier.triage", { actorLabel: "manager", detail: `candidate→qualified (no email): ${ids.length}` });
  }
  revalidatePath("/pipeline");
  revalidatePath("/suppliers");
}

export async function bulkIntro(_prev: BulkIntroResult | undefined, formData: FormData): Promise<BulkIntroResult> {
  if (!(await currentUser())) return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, error: "Не авторизовано" };
  const n = Number(formData.get("limit") ?? 5);
  const res = await bulkIntroCore(Number.isFinite(n) ? n : 5);
  revalidatePath("/pipeline");
  revalidatePath("/suppliers");
  return res;
}

export async function tagManager(formData: FormData) {
  await requireUser();
  const supplierId = String(formData.get("supplierId") ?? "");
  const managerId = String(formData.get("managerId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "PRICE_REVIEW");
  const kind = (kindRaw in TaskKind ? kindRaw : "PRICE_REVIEW") as TaskKind;
  if (!supplierId || !managerId) return;

  const [supplier, manager, session] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId } }),
    prisma.user.findUnique({ where: { id: managerId } }),
    auth(),
  ]);
  if (!supplier || !manager) return;

  await prisma.$transaction([
    prisma.task.create({
      data: buildTaggedTaskData({ kind, supplierId, supplierName: supplier.name, managerId }),
    }),
    prisma.note.create({
      data: {
        body: `Передано ${manager.name}`,
        authorId: session?.user?.id ?? null,
        entityType: EntityType.SUPPLIER,
        entityId: supplierId,
      },
    }),
  ]);

  revalidatePath("/pipeline");
  revalidatePath("/tasks");
  revalidatePath(`/suppliers/${supplierId}`);
}
