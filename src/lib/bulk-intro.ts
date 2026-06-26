import { prisma } from "@/lib/prisma";
import { createDraftForSupplier, sendDraftMessage } from "@/lib/email/draft";
import { audit } from "@/lib/audit";

export type BulkIntroResult = {
  ok: boolean;
  processed: number;
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
};

/**
 * Рассылка intro по неконтактированным поставщикам (CANDIDATE + QUALIFIED) с email, throttled,
 * рамп через limit. Только при EMAIL_TEST_MODE=false (реальный режим) — иначе пометил бы CONTACTED
 * без реальной отправки и при флипе они бы не получили письмо. Идемпотентно: успешная отправка
 * двигает статус CANDIDATE/QUALIFIED→CONTACTED (см. sendDraftMessage), так что следующий прогон их
 * не выберет. Opt-out и single-open-thread учитываются внутри createDraft/sendDraft.
 */
export async function bulkIntroCore(limit = 10, throttleMs = 1500): Promise<BulkIntroResult> {
  if (process.env.EMAIL_TEST_MODE !== "false") {
    return { ok: false, processed: 0, sent: 0, failed: 0, skipped: 0, error: "EMAIL_TEST_MODE on — bulk отключён (тестируй поштучным сендом)" };
  }
  const suppliers = await prisma.supplier.findMany({
    where: { status: { in: ["CANDIDATE", "QUALIFIED"] }, optedOut: false, contacts: { some: { email: { not: null } } } },
    orderBy: { createdAt: "asc" },
    take: Math.max(1, Math.min(limit, 100)),
    select: { id: true },
  });

  let sent = 0, failed = 0, skipped = 0;
  for (const s of suppliers) {
    const draft = await createDraftForSupplier(s.id, "INTRO", { skipHook: true });
    if (!draft.ok) { skipped++; continue; }
    const res = await sendDraftMessage(draft.messageDbId);
    if (res.ok) sent++;
    else failed++;
    if (throttleMs) await new Promise((r) => setTimeout(r, throttleMs));
  }
  await audit("email.bulk-intro", {
    actorLabel: "api",
    detail: `processed=${suppliers.length} sent=${sent} failed=${failed} skipped=${skipped}`,
  });
  return { ok: true, processed: suppliers.length, sent, failed, skipped };
}
