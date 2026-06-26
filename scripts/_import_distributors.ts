import { readFileSync } from "node:fs";
import Papa from "papaparse";
import { importDistributorRows } from "@/lib/import-core";
import { prisma } from "@/lib/prisma";

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: tsx _import_distributors.ts <csv>");
  const csv = readFileSync(file, "utf8").replace(/^﻿/, "");
  const rows = (Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data ?? []);
  console.log(`parsed rows: ${rows.length}`);
  const c = await importDistributorRows(rows);
  console.log("RESULT:", JSON.stringify(c));
}

main()
  .catch((e) => { console.error("IMPORT ERROR:", e?.message || e); process.exitCode = 1; })
  .finally(async () => { await prisma.$disconnect(); });
