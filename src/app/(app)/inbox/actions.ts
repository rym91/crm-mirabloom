"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { nextStatusOnReply } from "@/lib/email/route-status";
import { requireUser } from "@/lib/authz";

/**
 * Ручная привязка осиротевшего входящего к поставщику (фолбэк, когда авто-алиас не сработал).
 * Прикрепляет тред+письмо к поставщику, сохраняет адрес отправителя как Contact (чтобы дальше
 * цепочка матчилась сама), двигает статус → REPLIED (с уважением к ручной блокировке).
 */
export async function linkMessageToSupplier(formData: FormData): Promise<void> {
  await requireUser();
  const messageId = String(formData.get("messageId") ?? "");
  const supplierId = String(formData.get("supplierId") ?? "");
  if (!messageId || !supplierId) return;

  const msg = await prisma.emailMessage.findUnique({ where: { id: messageId } });
  if (!msg) return;
  const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
  if (!supplier) return;

  // прикрепить (orphan) тред и письмо к поставщику
  await prisma.emailThread.update({ where: { id: msg.threadId }, data: { supplierId } });

  // сохранить отправителя как контакт поставщика (для авто-матчинга следующих писем)
  let contact = await prisma.contact.findFirst({
    where: { supplierId, email: { equals: msg.fromAddress, mode: "insensitive" } },
  });
  if (!contact) {
    contact = await prisma.contact.create({
      data: { supplierId, name: msg.fromAddress.split("@")[0], email: msg.fromAddress, isPrimary: false },
    });
  }
  await prisma.emailMessage.update({ where: { id: messageId }, data: { supplierId, contactId: contact.id } });

  // статус -> REPLIED (если не заблокирован вручную и в ранней стадии)
  const next = nextStatusOnReply(supplier.status);
  const noteBody = next
    ? `Привязано вручную из /inbox: письмо от ${msg.fromAddress} → статус ${next}`
    : `Привязано вручную из /inbox: письмо от ${msg.fromAddress}`;
  if (next && next !== supplier.status) {
    await prisma.$transaction([
      prisma.supplier.update({ where: { id: supplierId }, data: { status: next } }),
      prisma.note.create({ data: { body: noteBody, entityType: "SUPPLIER", entityId: supplierId } }),
    ]);
  } else {
    await prisma.note.create({ data: { body: noteBody, entityType: "SUPPLIER", entityId: supplierId } });
  }

  revalidatePath("/inbox");
  revalidatePath(`/suppliers/${supplierId}`);
  revalidatePath("/pipeline");
}
