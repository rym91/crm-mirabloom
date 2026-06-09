import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { createTask, moveTask } from "./actions";

export const dynamic = "force-dynamic";

const COLUMNS: { key: string; label: string }[] = [
  { key: "TODO", label: "К выполнению" },
  { key: "IN_PROGRESS", label: "В работе" },
  { key: "WAITING", label: "Ожидание ответа" },
  { key: "DONE", label: "Готово" },
];

export default async function TasksPage() {
  const tasks = await prisma.task.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Задачи</h1>
      </div>

      <form action={createTask} className="flex gap-2">
        <Input name="title" placeholder="Новая задача…" className="max-w-md" required />
        <Button type="submit">Добавить</Button>
      </form>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const items = tasks.filter((t) => t.status === col.key);
          return (
            <div key={col.key} className="rounded-lg border bg-muted/30 p-3">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium">{col.label}</span>
                <Badge status={col.key}>{items.length}</Badge>
              </div>
              <div className="space-y-2">
                {items.map((t) => (
                  <div key={t.id} className="rounded-md border bg-card p-2 text-sm shadow-sm">
                    <div className="mb-2">{t.title}</div>
                    <form action={moveTask} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={t.id} />
                      <Select name="status" defaultValue={t.status} className="h-7 text-xs">
                        {COLUMNS.map((c) => (
                          <option key={c.key} value={c.key}>
                            {c.label}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" size="sm" variant="outline" className="h-7">
                        OK
                      </Button>
                    </form>
                  </div>
                ))}
                {items.length === 0 ? <p className="text-xs text-muted-foreground">—</p> : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}