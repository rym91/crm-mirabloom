import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { Prisma, type EmailThread } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { extractRoutingToken, extractMessageIds, normalizeSubject } from "@/lib/email/resolve";
import { classifyInbound } from "@/lib/email/classify";
import { nextStatusOnReply, nextStatusFromClassification } from "@/lib/email/route-status";
import { createDraftForSupplier } from "@/lib/email/draft";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRM_INBOUND_SECRET ?? "";
  const got = req.headers.get("x-crm-secret") ?? "";
  if (!secret || got.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

type InboundPayload = {
  messageId: string;
  inReplyTo?: string | null;
  references?: string | null;
  from: string;
  to?: string | null;
  subject: string;
  bodyText: string;
  bodyHtml?: string | null;
  attachmentNames?: string[];
};

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => null)) as InboundPayload | null;
  if (!body?.messageId || !body.from || typeof body.subject !== "string" || typeof body.bodyText !== "string") {
    return NextResponse.json({ error: "bad payload" }, { status: 400 });
  }

  // 1) idempotency
  const dup = await prisma.emailMessage.findUnique({ where: { messageId: body.messageId } });
  if (dup) return NextResponse.json({ ok: true, duplicate: true });

  // 2) resolve thread: routingToken -> direct message-id -> subject+sender fallback -> orphan
  let thread: EmailThread | null = null;
  const token = extractRoutingToken(body.inReplyTo, body.references);
  if (token) thread = await prisma.emailThread.findUnique({ where: { routingToken: token } });
  if (!thread) {
    const ids = extractMessageIds(body.inReplyTo, body.references);
    if (ids.length) {
      const ref = await prisma.emailMessage.findFirst({ where: { messageId: { in: ids } }, select: { threadId: true } });
      if (ref) thread = await prisma.emailThread.findUnique({ where: { id: ref.threadId } });
    }
  }
  const fromEmail = (body.from.match(/<([^<>]+)>/)?.[1] ?? body.from).trim().toLowerCase();
  const contact = await prisma.contact.findFirst({ where: { email: { equals: fromEmail, mode: "insensitive" } } });
  if (!thread && contact) {
    const norm = normalizeSubject(body.subject);
    const candidates = await prisma.emailThread.findMany({
      where: {
        supplierId: contact.supplierId,
        isClosed: false,
        lastMessageAt: { gte: new Date(Date.now() - 60 * 86_400_000) },
      },
    });
    thread = candidates.find((t) => normalizeSubject(t.subject) === norm) ?? null;
    // single open thread per supplier in MVP: fall back to the supplier's thread even if the subject drifted
    if (!thread && candidates.length === 1) thread = candidates[0];
  }
  if (!thread) {
    thread = await prisma.emailThread.create({
      data: { supplierId: contact?.supplierId ?? null, subject: body.subject },
    });
  }

  // 3) store INBOUND (unique messageId guards the race)
  let message;
  try {
    message = await prisma.emailMessage.create({
      data: {
        threadId: thread.id,
        supplierId: thread.supplierId,
        contactId: contact?.id ?? null,
        direction: "INBOUND",
        status: "RECEIVED",
        fromAddress: fromEmail,
        toAddress: body.to ?? process.env.SMTP_USER ?? "",
        subject: body.subject,
        bodyText: body.bodyText,
        bodyHtml: body.bodyHtml ?? null,
        messageId: body.messageId,
        inReplyTo: body.inReplyTo ?? null,
        references: body.references ?? null,
        receivedAt: new Date(),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return NextResponse.json({ ok: true, duplicate: true });
    }
    throw e;
  }

  // 4) stop follow-ups, bump thread
  await prisma.emailThread.update({
    where: { id: thread.id },
    data: { lastMessageAt: new Date(), lastDirection: "INBOUND", followUpDueAt: null },
  });

  // 5) classify (fail-safe inside) + persist
  const cls = await classifyInbound({
    subject: body.subject,
    bodyText: body.bodyText,
    attachmentNames: body.attachmentNames ?? [],
  });
  await prisma.emailMessage.update({
    where: { id: message.id },
    data: { aiClass: cls.class, aiConfidence: cls.confidence, aiSummary: cls.summary || null },
  });

  // 6) auto-status (reply -> classification), notes, QUOTED task, qualification draft
  let finalStatus: string | null = null;
  if (thread.supplierId) {
    const supplier = await prisma.supplier.findUnique({ where: { id: thread.supplierId } });
    if (supplier) {
      const afterReply = nextStatusOnReply(supplier.status) ?? supplier.status;
      const afterCls = nextStatusFromClassification(afterReply, cls.class, cls.confidence) ?? afterReply;
      if (afterCls !== supplier.status) {
        finalStatus = afterCls;
        await prisma.$transaction([
          prisma.supplier.update({ where: { id: supplier.id }, data: { status: afterCls } }),
          prisma.note.create({
            data: {
              body: `Авто: статус → ${afterCls} (ответ поставщика; AI: ${cls.class} ${Math.round(cls.confidence * 100)}%)`,
              entityType: "SUPPLIER",
              entityId: supplier.id,
            },
          }),
        ]);
      }
      if (afterCls === "QUOTED" && supplier.status !== "QUOTED") {
        await prisma.task.create({
          data: {
            title: `Прайс получен — передать менеджеру: ${supplier.name}`,
            kind: "PRICE_REVIEW",
            status: "TODO",
            entityType: "SUPPLIER",
            entityId: supplier.id,
          },
        });
      }
      // auto-draft the qualification reply (human sends it)
      await createDraftForSupplier(supplier.id, "QUALIFICATION", { skipHook: true });
    }
  }

  return NextResponse.json({ ok: true, threadId: thread.id, class: cls.class, status: finalStatus });
}
