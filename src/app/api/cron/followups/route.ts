import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { isManualLocked } from "@/lib/email/route-status";
import { nextFollowUp, addDays } from "@/lib/email/sequence";
import { createDraftForSupplier, sendDraftMessage } from "@/lib/email/draft";

export const dynamic = "force-dynamic";

// Только header x-cron-secret (без ?secret= — не течёт в логи/прокси). sha256→timingSafeEqual.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const got = req.headers.get("x-cron-secret") ?? "";
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

async function run() {
  const now = new Date();
  const due = await prisma.emailThread.findMany({
    where: {
      followUpDueAt: { lte: now },
      isClosed: false,
      lastDirection: "OUTBOUND",
      supplierId: { not: null },
    },
    include: { supplier: true },
  });
  let sent = 0;
  let skipped = 0;
  for (const t of due) {
    // Атомарный claim: гасим followUpDueAt только если он ещё «due». Если параллельный запуск
    // уже забрал тред — count===0 → пропускаем (нет двойной отправки).
    const claim = await prisma.emailThread.updateMany({
      where: { id: t.id, followUpDueAt: { lte: now } },
      data: { followUpDueAt: null },
    });
    if (claim.count !== 1) { skipped++; continue; }

    if (!t.supplier || isManualLocked(t.supplier.status)) { skipped++; continue; }
    const nxt = nextFollowUp(t.followUpStep);
    if (!nxt) { skipped++; continue; }
    const draft = await createDraftForSupplier(t.supplierId!, nxt.kind, { skipHook: true });
    if (!draft.ok) { skipped++; continue; } // напр. opted-out -> createDraft вернёт !ok → пропуск
    const res = await sendDraftMessage(draft.messageDbId);
    if (!res.ok) {
      // транзиентный сбой: повтор завтра, а не горячий цикл
      await prisma.emailThread.update({ where: { id: t.id }, data: { followUpDueAt: addDays(now, 1) } });
      skipped++;
      continue;
    }
    const after = nextFollowUp(nxt.step);
    await prisma.emailThread.update({
      where: { id: t.id },
      data: { followUpStep: nxt.step, followUpDueAt: after ? addDays(now, after.afterDays) : null },
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
