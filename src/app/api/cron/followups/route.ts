import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isManualLocked } from "@/lib/email/route-status";
import { nextFollowUp, addDays } from "@/lib/email/sequence";
import { createDraftForSupplier, sendDraftMessage } from "@/lib/email/draft";

export const dynamic = "force-dynamic";

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  const got = req.headers.get("x-cron-secret") ?? req.nextUrl.searchParams.get("secret") ?? "";
  if (!secret || got.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

async function run() {
  const due = await prisma.emailThread.findMany({
    where: {
      followUpDueAt: { lte: new Date() },
      isClosed: false,
      lastDirection: "OUTBOUND",
      supplierId: { not: null },
    },
    include: { supplier: true },
  });
  let sent = 0;
  let skipped = 0;
  for (const t of due) {
    const clearDue = () => prisma.emailThread.update({ where: { id: t.id }, data: { followUpDueAt: null } });
    if (!t.supplier || isManualLocked(t.supplier.status)) { await clearDue(); skipped++; continue; }
    const nxt = nextFollowUp(t.followUpStep);
    if (!nxt) { await clearDue(); skipped++; continue; }
    const draft = await createDraftForSupplier(t.supplierId!, nxt.kind, { skipHook: true });
    if (!draft.ok) { await clearDue(); skipped++; continue; }
    const res = await sendDraftMessage(draft.messageDbId);
    if (!res.ok) {
      // transient failure: retry tomorrow instead of hot-looping
      await prisma.emailThread.update({ where: { id: t.id }, data: { followUpDueAt: addDays(new Date(), 1) } });
      skipped++;
      continue;
    }
    const after = nextFollowUp(nxt.step);
    await prisma.emailThread.update({
      where: { id: t.id },
      data: { followUpStep: nxt.step, followUpDueAt: after ? addDays(new Date(), after.afterDays) : null },
    });
    sent++;
  }
  return { processed: due.length, sent, skipped };
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  return NextResponse.json(await run());
}
export const POST = GET;
