"use server";

import { revalidatePath } from "next/cache";
import { SupplierStatus, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { audit } from "@/lib/audit";

export async function updateSupplierStatus(formData: FormData) {
  await requireUser();
  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !(status in SupplierStatus)) return;
  await prisma.supplier.update({ where: { id }, data: { status: status as SupplierStatus } });
  await audit("supplier.status", { entityType: "SUPPLIER", entityId: id, detail: status });
  revalidatePath(`/suppliers/${id}`);
  revalidatePath("/suppliers");
}

export async function addSupplierContact(formData: FormData) {
  await requireUser();
  const supplierId = String(formData.get("supplierId") ?? "");
  const email = String(formData.get("email") ?? "").trim();
  const name = String(formData.get("name") ?? "").trim();
  if (!supplierId || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return;

  const exists = await prisma.contact.findFirst({
    where: { supplierId, email: { equals: email, mode: "insensitive" } },
  });
  if (!exists) {
    await prisma.contact.create({
      data: { supplierId, name: name || email.split("@")[0], email, isPrimary: false },
    });
  }
  // снять адрес из предложенных (customFields.suggestedEmails)
  const sup = await prisma.supplier.findUnique({ where: { id: supplierId }, select: { customFields: true } });
  const cf = (sup?.customFields as { suggestedEmails?: string[] } | null) ?? {};
  if (Array.isArray(cf.suggestedEmails)) {
    const left = cf.suggestedEmails.filter((e) => e.toLowerCase() !== email.toLowerCase());
    await prisma.supplier.update({ where: { id: supplierId }, data: { customFields: { ...cf, suggestedEmails: left } } });
  }
  await audit("supplier.contact.add", { entityType: "SUPPLIER", entityId: supplierId, detail: email });
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/suppliers");
  revalidatePath("/pipeline");
}

export async function addSupplierNote(formData: FormData) {
  await requireUser();
  const supplierId = String(formData.get("supplierId") ?? "");
  const body = String(formData.get("body") ?? "").trim();
  if (!supplierId || !body) return;
  await prisma.note.create({ data: { body, entityType: EntityType.SUPPLIER, entityId: supplierId } });
  revalidatePath(`/suppliers/${supplierId}`);
}
