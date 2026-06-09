import { prisma } from "@/lib/prisma";
import { Table, THead, TBody, TR, TH, TD } from "@/components/ui/table";

export const dynamic = "force-dynamic";

export default async function BrandsPage() {
  const brands = await prisma.brand.findMany({
    orderBy: [{ opportunityScore: "desc" }, { name: "asc" }],
    include: { _count: { select: { suppliers: true } } },
  });

  return (
    <div className="space-y-5">
      <h1 className="text-xl font-semibold">Бренды</h1>
      <Table>
        <THead>
          <TR>
            <TH>Бренд</TH>
            <TH>Категория</TH>
            <TH>ASIN прошло</TH>
            <TH>drops30</TH>
            <TH>Медиана BuyBox</TH>
            <TH>Медиана max-cost</TH>
            <TH>Opportunity</TH>
            <TH>Поставщиков</TH>
          </TR>
        </THead>
        <TBody>
          {brands.map((b) => (
            <TR key={b.id}>
              <TD className="font-medium">{b.name}</TD>
              <TD>{b.category ?? "—"}</TD>
              <TD>{b.nAsinsPassed ?? "—"}</TD>
              <TD>{b.totalDrops30 ?? "—"}</TD>
              <TD>{b.medianBuybox ?? "—"}</TD>
              <TD>{b.medianMaxCost ?? "—"}</TD>
              <TD>{b.opportunityScore ?? "—"}</TD>
              <TD>{b._count.suppliers}</TD>
            </TR>
          ))}
          {brands.length === 0 ? (
            <TR>
              <TD colSpan={8} className="text-center text-muted-foreground">
                Пусто. Бренды появятся после импорта из FBA Spain.
              </TD>
            </TR>
          ) : null}
        </TBody>
      </Table>
    </div>
  );
}