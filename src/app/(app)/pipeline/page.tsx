import Link from "next/link";
import { SupplierStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { moveSupplier, tagManager } from "./actions";

export const dynamic = "force-dynamic";

const COLUMNS: { key: SupplierStatus; label: string }[] = [
  { key: "CANDIDATE", label: "Кандидат" },
  { key: "QUALIFIED", label: "Квалифицирован" },
  { key: "CONTACTED", label: "Запрос отправлен" },
  { key: "REPLIED", label: "Ответил" },
  { key: "QUOTED", label: "Прислал прайс" },
  { key: "NEGOTIATING", label: "Переговоры" },
  { key: "ACTIVE", label: "Работаем" },
  { key: "MANUAL_REVIEW", label: "Ручная проверка" },
  { key: "ON_HOLD", label: "Пауза" },
  { key: "REJECTED", label: "Отклонён" },
];

export default async function PipelinePage() {
  const [suppliers, users] = await Promise.all([
    prisma.supplier.findMany({
      orderBy: { updatedAt: "desc" },
      include: {
        brands: { include: { brand: true } },
        threads: { orderBy: { lastMessageAt: "desc" }, take: 1, include: { messages: { orderBy: { createdAt: "desc" }, take: 1 } } },
      },
    }),
    prisma.user.findMany({ orderBy: { name: "asc" } }),
  ]);

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Пайплайн поставщиков</h1>
      <div className="flex gap-4 overflow-x-auto pb-4">
        {COLUMNS.map((col) => {
          const items = suppliers.filter((s) => s.status === col.key);
          return (
            <div key={col.key} className="w-72 shrink-0 rounded-lg border bg-muted/30 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">{col.label}</span>
                <Badge status={col.key}>{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((s) => {
                  const lastMsg = s.threads[0]?.messages[0];
                  return (
                    <div key={s.id} className="rounded-md border bg-card p-2 text-sm shadow-sm">
                      <Link href={`/suppliers/${s.id}`} className="font-medium text-primary hover:underline">
                        {s.name}
                      </Link>
                      <div className="text-xs text-muted-foreground">
                        {[s.country ?? "—", ...s.brands.map((b) => b.brand.name).slice(0, 2)].filter(Boolean).join(" · ")}
                      </div>
                      {col.key === "MANUAL_REVIEW" ? (
                        <div className="mt-1 rounded bg-muted/60 p-1 text-xs text-muted-foreground">
                          {lastMsg ? `✉ ${lastMsg.subject}` : "Переписки пока нет"}
                        </div>
                      ) : null}

                      <form action={moveSupplier} className="mt-2 flex items-center gap-1">
                        <input type="hidden" name="id" value={s.id} />
                        <Select name="status" defaultValue={s.status} className="h-7 text-xs">
                          {COLUMNS.map((c) => (
                            <option key={c.key} value={c.key}>
                              {c.label}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" size="sm" variant="outline" className="h-7">
                          ↔
                        </Button>
                      </form>

                      <form action={tagManager} className="mt-1 flex items-center gap-1">
                        <input type="hidden" name="supplierId" value={s.id} />
                        <input type="hidden" name="kind" value={s.status === "MANUAL_REVIEW" ? "MANUAL_REVIEW" : "PRICE_REVIEW"} />
                        <Select name="managerId" className="h-7 text-xs" required defaultValue="">
                          <option value="" disabled>
                            Передать менеджеру…
                          </option>
                          {users.map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.name}
                            </option>
                          ))}
                        </Select>
                        <Button type="submit" size="sm" className="h-7">
                          →
                        </Button>
                      </form>
                    </div>
                  );
                })}
                {items.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}