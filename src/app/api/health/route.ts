import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// Секрет-эндпоинт здоровья/метрик для n8n-дайджеста (тот же CRON_SECRET, header x-cron-secret).
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET ?? "";
  if (!secret) return false;
  const got = req.headers.get("x-cron-secret") ?? "";
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = new Date();
  const since = new Date(now.getTime() - 24 * 3600 * 1000);

  const [byStatus, optedOut, dueFollowups, sends24, sendFails24, inbound24, optouts24, imports24] =
    await Promise.all([
      prisma.supplier.groupBy({ by: ["status"], _count: true }),
      prisma.supplier.count({ where: { optedOut: true } }),
      prisma.emailThread.count({ where: { followUpDueAt: { lte: now }, isClosed: false } }),
      prisma.auditLog.count({ where: { action: "email.send", detail: { startsWith: "sent" }, createdAt: { gte: since } } }),
      prisma.auditLog.count({ where: { action: "email.send", detail: { startsWith: "fail" }, createdAt: { gte: since } } }),
      prisma.emailMessage.count({ where: { direction: "INBOUND", createdAt: { gte: since } } }),
      prisma.auditLog.count({ where: { action: "supplier.optout", createdAt: { gte: since } } }),
      prisma.auditLog.count({ where: { action: { startsWith: "import." }, createdAt: { gte: since } } }),
    ]);

  return NextResponse.json({
    ok: true,
    ts: now.toISOString(),
    emailTestMode: process.env.EMAIL_TEST_MODE !== "false", // true = реальная рассылка ЗАБЛОКИРОВАНА
    suppliers: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
    optedOut,
    dueFollowups,
    last24h: { sends: sends24, sendFails: sendFails24, inbound: inbound24, optouts: optouts24, imports: imports24 },
  });
}
export const POST = GET;
