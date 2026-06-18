"use server";

import { revalidatePath } from "next/cache";
import { SupplierStatus, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";

export async function updateSupplierStatus(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(status in SupplierStatus)) return;
  await prisma.supplier.update({ where: { id }, data: { status: status as SupplierStatus } });
  revalidatePath(`/suppliers/${id}`);
  revalidatePath("/suppliers");
}

export async function addSupplierNote(formData: FormData) {
  await requireUser();
  const supplierId = String(formData.get("supplierId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!supplierId || !body) return;
  await prisma.note.create({ data: { body, entityType: EntityType.SUPPLIER, entityId: supplierId } });
  revalidatePath(`/suppliers/${supplierId}`);
}
