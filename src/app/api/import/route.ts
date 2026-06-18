import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { importDistributorRows, importQualificationRows } from "@/lib/import-core";
import { createFormTasksCore } from "@/lib/form-tasks";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5_000_000; // лимит тела CSV (защита от memory-DoS)
const RL_MAX = 20; // запросов
const RL_WINDOW_MS = 60_000; // в окне 60с на источник
const hits = new Map<string, number[]>();

function rateLimited(key: string): boolean {
  const now = Date.now();
  const arr = (hits.get(key) ?? []).filter((t) => now - t < RL_WINDOW_MS);
  arr.push(now);
  hits.set(key, arr);
  return arr.length > RL_MAX;
}

// Отдельный секрет для импорта (НЕ тот же, что у inbound-email). Пока CRM_IMPORT_SECRET
// не задан — fallback на CRM_INBOUND_SECRET (безопасный rollout). sha256→timingSafeEqual:
// одинаковая длина дайджестов, нет утечки длины секрета и нет throw на разной длине.
function authorized(req: NextRequest): boolean {
  const secret = process.env.CRM_IMPORT_SECRET || process.env.CRM_INBOUND_SECRET || "";
  if (!secret) return false;
  const got = req.headers.get("x-import-secret") ?? "";
  const a = crypto.createHash("sha256").update(got).digest();
  const b = crypto.createHash("sha256").update(secret).digest();
  return crypto.timingSafeEqual(a, b);
}

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (rateLimited(ip)) return NextResponse.json({ error: "rate limited" }, { status: 429 });
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const type = req.nextUrl.searchParams.get("type");

  // form-tasks: без CSV — bulk по уже импортированным form-only поставщикам
  if (type === "form-tasks") {
    const c = await createFormTasksCore();
    revalidatePath("/tasks");
    revalidatePath("/pipeline");
    return NextResponse.json({ ok: true, type, ...c });
  }

  const len = Number(req.headers.get("content-length") || 0);
  if (len > MAX_BYTES) return NextResponse.json({ error: "body too large" }, { status: 413 });
  const csv = await req.text();
  if (csv.length > MAX_BYTES) return NextResponse.json({ error: "body too large" }, { status: 413 });
  if (!csv.trim()) return NextResponse.json({ error: "empty body" }, { status: 400 });
  const rows = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true }).data ?? [];

  try {
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
  } catch (e) {
    console.error("import error", e);
    return NextResponse.json({ error: "internal" }, { status: 500 });
  }
  return NextResponse.json({ error: "type must be distributors|qualification|form-tasks" }, { status: 400 });
}
