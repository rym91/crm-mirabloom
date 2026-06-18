import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { importDistributorRows, importQualificationRows } from "@/lib/import-core";
import { createFormTasksCore } from "@/lib/form-tasks";

export const dynamic = "force-dynamic";

// Программный импорт CSV (без браузера). Защита тем же секретом, что inbound-email
// (CRM_INBOUND_SECRET). Тело запроса = сырой CSV; ?type=distributors|qualification.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRM_INBOUND_SECRET ?? "";
  const got = req.headers.get("x-import-secret") ?? "";
  if (!secret || got.length !== secret.length) return false;
  return crypto.timingSafeEqual(Buffer.from(got), Buffer.from(secret));
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const type = req.nextUrl.searchParams.get("type");

  // form-tasks: без CSV — bulk по уже импортированным form-only поставщикам
  if (type === "form-tasks") {
    const c = await createFormTasksCore();
    revalidatePath("/tasks");
    revalidatePath("/pipeline");
    return NextResponse.json({ ok: true, type, ...c });
  }

  const csv = await req.text();
  if (!csv.trim()) return NextResponse.json({ error: "empty body" }, { status: 400 });
  const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data ?? [];

  if (type === "distributors") {
    const c = await importDistributorRows(rows);
    revalidatePath("/suppliers");
    revalidatePath("/brands");
    return NextResponse.json({ ok: true, type, rows: rows.length, ...c });
  }
  if (type === "qualification") {
    const c = await importQualificationRows(rows);
    revalidatePath("/suppliers");
    revalidatePath("/pipeline");
    return NextResponse.json({ ok: true, type, rows: rows.length, ...c });
  }
  return NextResponse.json({ error: "type must be distributors|qualification|form-tasks" }, { status: 400 });
}
