import Link from "next/link";
import { SupplierStatus, type Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { SupplierSignals, hasNewReply } from "@/components/supplier-signals";

export const dynamic = "force-dynamic";

const STATUSES = Object.values(SupplierStatus);

export default async function SuppliersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; email?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.status && sp.status in SupplierStatus ? (sp.status as SupplierStatus) : undefined;
  const emailFilter = sp.email === "none" || sp.email === "has" ? sp.email : undefined;

  const where: Prisma.SupplierWhereInput = {
    ...(filter ? { status: filter } : {}),
    ...(emailFilter === "none" ? { contacts: { none: { email: { not: null } } } } : {}),
    ...(emailFilter === "has" ? { contacts: { some: { email: { not: null } } } } : {}),
  };

  const suppliers = await prisma.supplier.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { brands: true, contacts: true } },
      tags: { include: { tag: true } },
      threads: { select: { lastDirection: true, isClosed: true } },
    },
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Поставщики</h1>
        <Link href="/import" className="text-sm text-primary underline">
          + Импорт из FBA Spain
        </Link>
      </div>

      <form method="get" className="flex flex-wrap items-center gap-2">
        <Select name="status" defaultValue={filter ?? ""} className="max-w-[200px]">
          <option value="">Все статусы</option>
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
        <Select name="email" defaultValue={emailFilter ?? ""} className="max-w-[170px]">
          <option value="">Email: все</option>
          <option value="none">Без email</option>
          <option value="has">С email</option>
        </Select>
        <Button type="submit" variant="outline" size="sm">
          Фильтр
        </Button>
      </form>

      <Table>
        <THead>
          <TR>
            <TH>Поставщик</TH>
            <TH>Сигналы</TH>
            <TH>Страна</TH>
            <TH>Статус</TH>
            <TH>Tier</TH>
            <TH>Score</TH>
            <TH>Бренды</TH>
            <TH>Контакты</TH>
          </TR>
        </THead>
        <TBody>
          {suppliers.map((s) => (
            <TR key={s.id}>
              <TD>
                <Link href={`/suppliers/${s.id}`} className="font-medium text-primary hover:underline">
                  {s.name}
                </Link>
              </TD>
              <TD>
                <SupplierSignals
                  newReply={hasNewReply(s.threads)}
                  tags={s.tags.map((t) => ({ name: t.tag.name }))}
                />
              </TD>
              <TD>{s.country ?? "—"}</TD>
              <TD>
                <Badge status={s.status}>{s.status}</Badge>
              </TD>
              <TD>{s.tier ?? "—"}</TD>
              <TD>{s.score ?? "—"}</TD>
              <TD>{s._count.brands}</TD>
              <TD>{s._count.contacts}</TD>
            </TR>
          ))}
          {suppliers.length === 0 ? (
            <TR>
              <TD colSpan={8} className="text-center text-muted-foreground">
                Пусто. Импортируйте distributor_candidates.csv на странице «Импорт».
              </TD>
            </TR>
          ) : null}
        </TBody>
      </Table>
    </div>
  );
}