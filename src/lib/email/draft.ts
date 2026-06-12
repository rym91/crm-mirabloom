import { prisma } from "@/lib/prisma";
import type { TemplateKind } from "@prisma/client";
import { renderTemplate, textToHtml } from "./template";
import { generateMessageId, sendEmail } from "./send";
import { generateOpeningHook } from "./hook";
import { nextStatusOnSend } from "./route-status";
import { nextFollowUp, addDays } from "./sequence";

export type DraftResult = { ok: true; messageDbId: string; threadId: string } | { ok: false; error: string };

export async function createDraftForSupplier(
  supplierId: string,
  kind: TemplateKind,
  opts: { skipHook?: boolean } = {}
): Promise<DraftResult> {
  const supplier = await prisma.supplier.findUnique({
    where: { id: supplierId },
    include: {
      contacts: { orderBy: [{ isPrimary: "desc" }, { createdAt: "asc" }] },
      brands: { include: { brand: true } },
      threads: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });
  if (!supplier) return { ok: false, error: "Поставщик не найден" };
  const contact = supplier.contacts.find((c) => c.email);
  if (!contact?.email) return { ok: false, error: "У поставщика нет контакта с email" };
  const template = await prisma.emailTemplate.findUnique({ where: { kind } });
  if (!template) return { ok: false, error: `Шаблон ${kind} не засеян (npm run db:seed)` };

  const brand = supplier.brands[0]?.brand.name ?? supplier.name;
  const contactName = contact.name && !contact.name.includes("@") ? contact.name : "there";
  let openingHook = "";
  if (kind === "INTRO" && !opts.skipHook) {
    openingHook = await generateOpeningHook({
      supplierName: supplier.name,
      brands: supplier.brands.map((b) => b.brand.name),
      country: supplier.country,
      notes: supplier.notes,
      sourceUrl: supplier.sourceUrl,
    });
  }
  const vars = { brand, contact: contactName, openingHook };
  const subject = renderTemplate(template.subject, vars);
  const bodyText = renderTemplate(template.bodyHtml, vars); // bodyHtml column = plain-text template source

  let thread = supplier.threads[0] ?? null;
  if (!thread) {
    thread = await prisma.emailThread.create({ data: { supplierId, subject } });
  }
  const existingDraft = await prisma.emailMessage.findFirst({ where: { threadId: thread.id, status: "DRAFT" } });
  if (existingDraft) return { ok: true, messageDbId: existingDraft.id, threadId: thread.id };

  const prev = await prisma.emailMessage.findMany({
    where: { threadId: thread.id, messageId: { not: null } },
    orderBy: { createdAt: "asc" },
    select: { messageId: true },
  });
  const last = prev[prev.length - 1];
  const msg = await prisma.emailMessage.create({
    data: {
      threadId: thread.id,
      supplierId,
      contactId: contact.id,
      direction: "OUTBOUND",
      status: "DRAFT",
      fromAddress: process.env.SMTP_USER ?? "",
      toAddress: contact.email,
      subject,
      bodyText,
      bodyHtml: textToHtml(bodyText),
      messageId: generateMessageId(thread.routingToken),
      inReplyTo: last?.messageId ?? null,
      references: prev.map((m) => m.messageId!).join(" ") || null,
    },
  });
  return { ok: true, messageDbId: msg.id, threadId: thread.id };
}

export async function sendDraftMessage(messageDbId: string): Promise<{ ok: boolean; error?: string }> {
  const msg = await prisma.emailMessage.findUnique({
    where: { id: messageDbId },
    include: { thread: true, supplier: true },
  });
  if (!msg || !msg.thread) return { ok: false, error: "Черновик не найден" };
  if (msg.status !== "DRAFT") return { ok: true }; // idempotent

  const res = await sendEmail({
    to: msg.toAddress,
    subject: msg.subject,
    text: msg.bodyText ?? "",
    html: msg.bodyHtml ?? undefined,
    messageId: msg.messageId!,
    inReplyTo: msg.inReplyTo ?? undefined,
    references: msg.references ?? undefined,
  });
  if (!res.ok) {
    await prisma.emailMessage.update({ where: { id: msg.id }, data: { status: "FAILED" } });
    return { ok: false, error: res.error };
  }
  const now = new Date();
  const hadSentOutbound = await prisma.emailMessage.findFirst({
    where: { threadId: msg.threadId, direction: "OUTBOUND", status: "SENT" },
    select: { id: true },
  });
  await prisma.emailMessage.update({ where: { id: msg.id }, data: { status: "SENT", sentAt: now } });
  const first = nextFollowUp(0);
  await prisma.emailThread.update({
    where: { id: msg.threadId },
    data: {
      lastMessageAt: now,
      lastDirection: "OUTBOUND",
      // start the follow-up chain only on the FIRST outbound of the thread
      ...(hadSentOutbound ? {} : { followUpDueAt: addDays(now, first!.afterDays), followUpStep: 0 }),
    },
  });
  if (msg.supplierId && msg.supplier) {
    const next = nextStatusOnSend(msg.supplier.status);
    if (next) {
      await prisma.$transaction([
        prisma.supplier.update({ where: { id: msg.supplierId }, data: { status: next } }),
        prisma.note.create({
          data: { body: `Авто: статус → ${next} (письмо отправлено)`, entityType: "SUPPLIER", entityId: msg.supplierId },
        }),
      ]);
    }
  }
  return { ok: true };
}