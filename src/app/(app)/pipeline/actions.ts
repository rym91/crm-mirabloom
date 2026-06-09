"use server";

import { revalidatePath } from "next/cache";
import { SupplierStatus, TaskKind, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { buildTaggedTaskData } from "@/lib/tasks";

export async function moveSupplier(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(status in SupplierStatus)) return;
  await prisma.supplier.update({ where: { id }, data: { status: status as SupplierStatus } });
  revalidatePath("/pipeline");
  revalidatePath(`/suppliers/${id}`);
}

export async function tagManager(formData: FormData) {
  const supplierId = String(formData.get("supplierId") ?? "");
  const managerId = String(formData.get("managerId") ?? "");
  const kindRaw = String(formData.get("kind") ?? "PRICE_REVIEW");
  const kind = (kindRaw in TaskKind ? kindRaw : "PRICE_REVIEW") as TaskKind;
  if (!supplierId || !managerId) return;

  const [supplier, manager] = await Promise.all([
    prisma.supplier.findUnique({ where: { id: supplierId } }),
    prisma.user.findUnique({ where: { id: managerId } }),
  ]);
  if (!supplier || !manager) return;

  const session = await auth();
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