import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { groupTasksByDay, type DayGroup } from "@/lib/tasks";
import { createTask, moveTask, createFormTasks, assignTask, deleteTask } from "./actions";

export const dynamic = "force-dynamic";

const COLUMNS = [
  { key: "TODO", label: "К выполнению" },
  { key: "IN_PROGRESS", label: "В работе" },
  { key: "WAITING", label: "Ожидание ответа" },
  { key: "DONE", label: "Готово" },
];

const DAY_ORDER: { key: DayGroup; label: string }[] = [
  { key: "overdue", label: "Просрочено" },
  { key: "today", label: "Сегодня" },
  { key: "noDate", label: "Без срока" },
  { key: "later", label: "Позже" },
];

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string; assignee?: string }>;
}) {
  const sp = await searchParams;
  const view = sp.view === "board" ? "board" : "day";
  const session = await auth();
  const meId = session?.user?.id ?? "";
  const users = await prisma.user.findMany({ orderBy: { name: "asc" } });

  const tabClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm ${active ? "bg-accent font-medium" : "text-muted-foreground hover:bg-accent/60"}`;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Задачи</h1>
        <div className="flex gap-1">
          <Link href="/tasks?view=day" className={tabClass(view === "day")}>
            Мой день
          </Link>
          <Link href="/tasks?view=board" className={tabClass(view === "board")}>
            Доска команды
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <form action={createTask} className="flex gap-2">
          <Input name="title" placeholder="Новая задача…" className="max-w-md" required />
          <Button type="submit">Добавить</Button>
        </form>
        <form action={createFormTasks}>
          <Button type="submit" variant="outline" title="Создать задачи FILL_FORM для form-only поставщиков">
            Создать задачи на формы
          </Button>
        </form>
      </div>

      {view === "day" ? (
        <MyDay meId={meId} />
      ) : (
        <TeamBoard assignee={sp.assignee ?? "me"} meId={meId} users={users} />
      )}
    </div>
  );
}

async function MyDay({ meId }: { meId: string }) {
  const tasks = await prisma.task.findMany({
    where: { assigneeId: meId, status: { not: "DONE" } },
    orderBy: [{ dueAt: "asc" }, { createdAt: "desc" }],
  });
  const groups = groupTasksByDay(tasks, new Date());

  return (
    <div className="space-y-5">
      {DAY_ORDER.map((g) => (
        <div key={g.key}>
          <div className="mb-2 flex items-center gap-2">
            <span className="text-sm font-medium">{g.label}</span>
            <Badge status={g.key === "overdue" ? "REJECTED" : g.key === "today" ? "IN_PROGRESS" : "TODO"}>
              {groups[g.key].length}
            </Badge>
          </div>
          <div className="space-y-2">
            {groups[g.key].map((t) => (
              <div key={t.id} className="rounded-md border bg-card p-2 text-sm shadow-sm">
                <div className="flex items-center justify-between gap-2">
                  <span>{t.title}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {t.dueAt ? t.dueAt.toLocaleDateString("ru-RU") : ""}
                    </span>
                    <form action={deleteTask}>
                      <input type="hidden" name="id" value={t.id} />
                      <button type="submit" title="Удалить задачу" className="text-xs text-muted-foreground hover:text-red-600">
                        ✕
                      </button>
                    </form>
                  </div>
                </div>
                {t.description ? (
                  <div className="mt-1 whitespace-pre-wrap break-words text-xs text-muted-foreground">
                    {t.description}
                  </div>
                ) : null}
                <form action={moveTask} className="mt-2 flex items-center gap-1">
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
            {groups[g.key].length === 0 ? <p className="text-xs text-muted-foreground">—</p> : null}
          </div>
        </div>
      ))}
    </div>
  );
}

async function TeamBoard({
  assignee,
  meId,
  users,
}: {
  assignee: string;
  meId: string;
  users: { id: string; name: string }[];
}) {
  const where =
    assignee === "all" ? {} : { assigneeId: assignee === "me" ? meId : assignee };
  const tasks = await prisma.task.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: { assignee: true },
  });

  return (
    <div className="space-y-4">
      <form method="get" className="flex items-center gap-2">
        <input type="hidden" name="view" value="board" />
        <Select name="assignee" defaultValue={assignee} className="max-w-[220px]">
          <option value="me">Мои</option>
          <option value="all">Все</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </Select>
        <Button type="submit" variant="outline" size="sm">
          Применить
        </Button>
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
                  <div key={t.id} className="space-y-2 rounded-md border bg-card p-2 text-sm shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-medium">{t.title}</span>
                      <form action={deleteTask}>
                        <input type="hidden" name="id" value={t.id} />
                        <button
                          type="submit"
                          title="Удалить задачу"
                          className="text-xs text-muted-foreground hover:text-red-600"
                        >
                          ✕
                        </button>
                      </form>
                    </div>
                    {t.description ? (
                      <div className="whitespace-pre-wrap break-words text-xs text-muted-foreground">
                        {t.description}
                      </div>
                    ) : null}
                    <form action={assignTask} className="flex items-center gap-1">
                      <input type="hidden" name="id" value={t.id} />
                      <Select name="assigneeId" defaultValue={t.assigneeId ?? ""} className="h-7 text-xs">
                        <option value="">— не назначен —</option>
                        {users.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.name}
                          </option>
                        ))}
                      </Select>
                      <Button type="submit" size="sm" variant="outline" className="h-7">
                        Назначить
                      </Button>
                    </form>
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