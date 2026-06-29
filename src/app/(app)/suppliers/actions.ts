"use server";

import { revalidatePath } from "next/cache";
import { SupplierStatus, EntityType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/authz";
import { nextStatusOnSend } from "@/lib/email/route-status";
import { supplierAlias } from "@/lib/email/alias";
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

export async function logFormOutreach(formData: FormData) {
  await requireUser();
  const supplierId = String(formData.get("supplierId") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!supplierId) return;
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return;

  let thread = await prisma.emailThread.findFirst({
    where: { supplierId, isClosed: false },
    orderBy: { createdAt: "asc" },
  });
  if (!thread) {
    thread = await prisma.emailThread.create({
      data: { supplierId, subject: `Wholesale enquiry (форма) — ${supplier.name}` },
    });
  }

  const alias = supplierAlias(supplierId);
  await prisma.emailMessage.create({
    data: {
      threadId: thread.id,
      supplierId,
      direction: "OUTBOUND",
      status: "SENT",
      fromAddress: alias,
      toAddress: supplier.contactFormUrl || "(контактная форма)",
      subject: "Отправлено через контактную форму",
      bodyText: note || "Запрос отправлен через контактную форму поставщика.",
      sentAt: new Date(),
    },
  });
  await prisma.emailThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date(), lastDirection: "OUTBOUND" },
  });

  const next = nextStatusOnSend(supplier.status);
  if (next && next !== supplier.status) {
    await prisma.supplier.update({ where: { id: supplierId }, data: { status: next } });
  }
  await prisma.note.create({
    data: {
      body: `Отправлено через контактную форму${note ? ": " + note.slice(0, 200) : ""}. Адрес для ответа: ${alias}`,
      entityType: EntityType.SUPPLIER,
      entityId: supplierId,
    },
  });
  await audit("email.form-outreach", { entityType: "SUPPLIER", entityId: supplierId, detail: alias });
  revalidatePath(`/suppliers/${supplierId}`);
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
