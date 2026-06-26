import { prisma } from "@/lib/prisma";
async function main() {
  const q = async (sql: string) => (await prisma.$queryRawUnsafe<Array<{ n: bigint }>>(sql))[0].n.toString();
  console.log("Supplier total:", await q(`select count(*)::bigint n from "Supplier"`));
  console.log("Brand total:", await q(`select count(*)::bigint n from "Brand"`));
  console.log("SupplierBrand total:", await q(`select count(*)::bigint n from "SupplierBrand"`));
  console.log("Contact total:", await q(`select count(*)::bigint n from "Contact"`));
  console.log("Suppliers created today:", await q(`select count(*)::bigint n from "Supplier" where "createdAt"::date = CURRENT_DATE`));
}
main().catch((e) => { console.error("ERR:", e?.message || e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
