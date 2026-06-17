import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { linkMessageToSupplier } from "./actions";

export const dynamic = "force-dynamic";

const CLASS_LABEL: Record<string, string> = {
  PRICE_LIST: "Прайс-лист",
  QUESTION: "Вопрос",
  REJECTION: "Отказ",
  OTHER: "Прочее",
};

export default async function InboxPage() {
  const messages = await prisma.emailMessage.findMany({
    where: { direction: "INBOUND" },
    orderBy: [{ receivedAt: "desc" }, { createdAt: "desc" }],
    take: 100,
    include: { thread: { include: { supplier: { select: { id: true, name: true } } } } },
  });
  const hasOrphan = messages.some((m) => !m.thread?.supplier);
  const suppliers = hasOrphan
    ? await prisma.supplier.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Входящие</h1>
        <span className="text-sm text-muted-foreground">{messages.length} писем</span>
      </div>
      <p className="text-sm text-muted-foreground">
        Ответы поставщиков, классифицированные AI. Письма от адресов, которых нет в базе, помечены
        «не сопоставлено» — их можно прочитать здесь и при необходимости завести поставщика вручную.
      </p>

      <div className="space-y-3">
        {messages.map((m) => {
          const supplier = m.thread?.supplier ?? null;
          const cls = m.aiClass ?? "OTHER";
          return (
            <div key={m.id} className="rounded-md border p-3 text-sm">
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <Badge status={cls}>{CLASS_LABEL[cls] ?? cls}</Badge>
                {m.aiConfidence != null ? <span>{Math.round(m.aiConfidence * 100)}%</span> : null}
                <span>{(m.receivedAt ?? m.createdAt).toLocaleString("ru-RU")}</span>
                <span className="ml-auto">
                  {supplier ? (
                    <Link href={`/suppliers/${supplier.id}`} className="text-primary hover:underline">
                      {supplier.name}
                    </Link>
                  ) : (
                    <Badge className="bg-zinc-100 text-zinc-500">не сопоставлено</Badge>
                  )}
                </span>
              </div>
              <div className="font-medium">{m.subject || "(без темы)"}</div>
              <div className="text-xs text-muted-foreground">от {m.fromAddress}</div>
              {m.aiSummary ? <div className="mt-2 text-muted-foreground">{m.aiSummary}</div> : null}
              {!supplier ? (
                <form action={linkMessageToSupplier} className="mt-2 flex flex-wrap items-center gap-2">
                  <input type="hidden" name="messageId" value={m.id} />
                  <select
                    name="supplierId"
                    required
                    defaultValue=""
                    className="rounded border px-2 py-1 text-xs"
                  >
                    <option value="" disabled>
                      Привязать к поставщику…
                    </option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded bg-primary px-2 py-1 text-xs text-primary-foreground hover:opacity-90"
                  >
                    Привязать
                  </button>
                </form>
              ) : null}
            </div>
          );
        })}
        {messages.length === 0 ? (
          <p className="text-sm text-muted-foreground">Входящих писем пока нет.</p>
        ) : null}
      </div>
    </div>
  );
}
