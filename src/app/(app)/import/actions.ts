"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { importDistributorRows, importQualificationRows } from "@/lib/import-core";

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
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ...empty, error: "Файл не выбран" };

  const rows = parseCsv(await file.text());
  const c = await importDistributorRows(rows);
  revalidatePath("/suppliers");
  revalidatePath("/brands");
  return { ok: true, rows: rows.length, ...c };
}

export async function importQualification(
  _prev: QualResult | undefined,
  formData: FormData
): Promise<QualResult> {
  const empty: QualResult = { ok: false, rows: 0, matched: 0, qualified: 0, rejected: 0, viesValid: 0, notMatched: 0 };
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ...empty, error: "Файл не выбран" };

  const rows = parseCsv(await file.text());
  const c = await importQualificationRows(rows);
  revalidatePath("/suppliers");
  revalidatePath("/pipeline");
  return { ok: true, rows: rows.length, ...c };
}
