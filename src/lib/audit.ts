import { prisma } from "@/lib/prisma";
import { currentUser } from "@/lib/authz";

// Запись в журнал аудита мутаций. Актор берётся из сессии (UI-actions); для API/cron/system
// передаётся actorLabel явно. Любой сбой записи проглатывается — аудит не должен ломать действие.
export async function audit(
  action: string,
  opts: { entityType?: string; entityId?: string; detail?: string; actorLabel?: string } = {}
): Promise<void> {
  let actorId: string | null = null;
  let actorLabel = opts.actorLabel ?? "system";
  if (!opts.actorLabel) {
    const u = await currentUser();
    if (u) {
      actorId = (u as { id?: string }).id ?? null;
      actorLabel = (u as { email?: string; name?: string }).email ?? (u as { name?: string }).name ?? "user";
    }
  }
  try {
    await prisma.auditLog.create({
      data: {
        actorId,
        actorLabel,
        action,
        entityType: opts.entityType ?? null,
        entityId: opts.entityId ?? null,
        detail: opts.detail ?? null,
      },
    });
  } catch {
    /* журнал аудита не должен ронять основную операцию */
  }
}
