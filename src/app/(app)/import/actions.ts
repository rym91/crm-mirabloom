"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { importDistributorRows, importQualificationRows } from "@/lib/import-core";
import { currentUser } from "@/lib/authz";
import { audit } from "@/lib/audit";

export type ImportResult = {
  ok: boolean;
  rows: number;
  brands: number;
  suppliers: number;
  contacts: number;
  links: number;
  error?: string;
};

export type QualResult = {
  ok: boolean;
  rows: number;
  matched: number;
  qualified: number;
  rejected: number;
  viesValid: number;
  notMatched: number;
  error?: string;
};

function parseCsv(text: string): Record<string, string>[] {
  return Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true }).data ?? [];
}

export async function importDistributors(
  _prev: ImportResult | undefined,
  formData: FormData
): Promise<ImportResult> {
  const empty: ImportResult = { ok: false, rows: 0, brands: 0, suppliers: 0, contacts: 0, links: 0 };
  if (!(await currentUser())) return { ...empty, error: "Не авторизовано" };
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ...empty, error: "Файл не выбран" };

  const rows = parseCsv(await file.text());
  const c = await importDistributorRows(rows);
  await audit("import.distributors", { detail: `rows=${rows.length} +suppliers=${c.suppliers} +brands=${c.brands} +links=${c.links}` });
  revalidatePath("/suppliers");
  revalidatePath("/brands");
  return { ok: true, rows: rows.length, ...c };
}

export async function importQualification(
  _prev: QualResult | undefined,
  formData: FormData
): Promise<QualResult> {
  const empty: QualResult = { ok: false, rows: 0, matched: 0, qualified: 0, rejected: 0, viesValid: 0, notMatched: 0 };
  if (!(await currentUser())) return { ...empty, error: "Не авторизовано" };
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ...empty, error: "Файл не выбран" };

  const rows = parseCsv(await file.text());
  const c = await importQualificationRows(rows);
  await audit("import.qualification", { detail: `rows=${rows.length} matched=${c.matched} qualified=${c.qualified} rejected=${c.rejected}` });
  revalidatePath("/suppliers");
  revalidatePath("/pipeline");
  return { ok: true, rows: rows.length, ...c };
}
