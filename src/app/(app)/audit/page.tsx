import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AuditPage() {
  const logs = await prisma.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 200 });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Аудит</h1>
        <span className="text-sm text-muted-foreground">последние {logs.length}</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Журнал мутаций: импорты, смена статусов, отправка писем, удаления, отписки/bounce. Кто, что, когда.
      </p>
      <div className="overflow-x-auto rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-2">Когда</th>
              <th className="p-2">Кто</th>
              <th className="p-2">Действие</th>
              <th className="p-2">Объект</th>
              <th className="p-2">Детали</th>
            </tr>
          </thead>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id} className="border-t align-top">
                <td className="whitespace-nowrap p-2 text-xs text-muted-foreground">
                  {l.createdAt.toLocaleString("ru-RU")}
                </td>
                <td className="p-2">{l.actorLabel}</td>
                <td className="p-2 font-mono text-xs">{l.action}</td>
                <td className="p-2 text-xs text-muted-foreground">
                  {l.entityType ? `${l.entityType}:${(l.entityId ?? "").slice(0, 8)}` : "—"}
                </td>
                <td className="p-2 text-xs text-muted-foreground">{l.detail ?? ""}</td>
              </tr>
            ))}
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-3 text-sm text-muted-foreground">
                  Записей пока нет.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
