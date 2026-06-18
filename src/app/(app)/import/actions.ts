"use server";

import Papa from "papaparse";
import { revalidatePath } from "next/cache";
import { LeadSource, Confidence, AuthorizedHint, ViesStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { domainOf, matchSupplierByDomain } from "@/lib/import-dedup";

export type ImportResult = {
  ok: boolean;
  rows: number;
  brands: number;
  suppliers: number;
  contacts: number;
  links: number;
  error?: string;
};

const leadMap: Record<string, LeadSource> = {
  brand_page: "BRAND_PAGE",
  directory: "DIRECTORY",
  impressum: "IMPRESSUM",
  search: "SEARCH",
};
const confMap: Record<string, Confidence> = { high: "HIGH", med: "MED", low: "LOW" };
const authMap: Record<string, AuthorizedHint> = { yes: "YES", maybe: "MAYBE", no: "NO" };

export async function importDistributors(
  _prev: ImportResult | undefined,
  formData: FormData
): Promise<ImportResult> {
  const empty: ImportResult = { ok: false, rows: 0, brands: 0, suppliers: 0, contacts: 0, links: 0 };
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ...empty, error: "Файл не выбран" };

  const text = await file.text();
  const parsed = Papa.parse<Record<string, string>>(text, { header: true, skipEmptyLines: true });
  const rows = parsed.data ?? [];

  let brands = 0;
  let suppliers = 0;
  let contacts = 0;
  let links = 0;
  const supplierCache = new Map<string, string>();

  for (const r of rows) {
    const get = (k: string) => (r[k] ?? "").trim();
    const brandName = get("brand");
    const distName = get("distributor_name");
    if (!brandName && !distName) continue;

    let brandId: string | null = null;
    if (brandName) {
      const b = await prisma.brand.upsert({ where: { name: brandName }, update: {}, create: { name: brandName } });
      brandId = b.id;
      brands++;
    }

    const website = get("website");
    const dom = domainOf(website);
    const cacheKey = dom ?? distName.toLowerCase();
    let supplierId = supplierCache.get(cacheKey);
    if (!supplierId) {
      // ТОЧНЫЙ матч по домену: грубо сужаем contains-запросом, затем сверяем нормализованный
      // домен строго (иначе "acme.com" слепится с "myacme.com").
      const existing = dom
        ? matchSupplierByDomain(
            await prisma.supplier.findMany({ where: { website: { contains: dom } } }),
            dom
          )
        : distName
          ? await prisma.supplier.findFirst({ where: { name: distName } })
          : null;
      if (existing) {
        supplierId = existing.id;
      } else {
        const s = await prisma.supplier.create({
          data: {
            name: distName || dom || "Unknown",
            country: get("country") || null,
            website: website || null,
            contactFormUrl: get("contact_form_url") || null,
            vatNumber: get("vat_or_impressum") || null,
            leadSource: leadMap[get("source_type").toLowerCase()] ?? "MANUAL",
            sourceUrl: get("source_url") || null,
            notes: get("notes") || null,
          },
        });
        supplierId = s.id;
        suppliers++;
      }
      supplierCache.set(cacheKey, supplierId);
    }

    const email = get("contact_email");
    if (email && supplierId) {
      const existsC = await prisma.contact.findFirst({ where: { supplierId, email } });
      if (!existsC) {
        await prisma.contact.create({
          data: { supplierId, name: email.split("@")[0], email, isPrimary: true },
        });
        contacts++;
      }
    }

    if (supplierId && brandId) {
      await prisma.supplierBrand.upsert({
        where: { supplierId_brandId: { supplierId, brandId } },
        update: {},
        create: {
          supplierId,
          brandId,
          leadSource: leadMap[get("source_type").toLowerCase()] ?? null,
          sourceUrl: get("source_url") || null,
          confidence: confMap[get("confidence").toLowerCase()] ?? null,
          authorizedHint: authMap[get("authorized_hint").toLowerCase()] ?? null,
          notes: get("notes") || null,
        },
      });
      links++;
    }
  }

  revalidatePath("/suppliers");
  revalidatePath("/brands");
  return { ok: true, rows: rows.length, brands, suppliers, contacts, links };
}

// ---------- Импорт квалификации (Фаза A) ----------
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

const viesMap: Record<string, ViesStatus> = { VALID: "VALID", INVALID: "INVALID" };

export async function importQualification(
  _prev: QualResult | undefined,
  formData: FormData
): Promise<QualResult> {
  const empty: QualResult = { ok: false, rows: 0, matched: 0, qualified: 0, rejected: 0, viesValid: 0, notMatched: 0 };
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) return { ...empty, error: "Файл не выбран" };

  const parsed = Papa.parse<Record<string, string>>(await file.text(), { header: true, skipEmptyLines: true });
  const rows = parsed.data ?? [];
  let matched = 0, qualified = 0, rejected = 0, viesValid = 0, notMatched = 0;

  for (const r of rows) {
    const get = (k: string) => (r[k] ?? "").trim();
    const website = get("website");
    const name = get("supplier");
    if (!website && !name) continue;

    const dom = domainOf(website);
    let supplier: Awaited<ReturnType<typeof prisma.supplier.findFirst>> = null;
    if (dom) {
      const sameDom = await prisma.supplier.findMany({ where: { website: { contains: dom } } });
      supplier = matchSupplierByDomain(sameDom, dom);
    }
    if (!supplier && name) supplier = await prisma.supplier.findFirst({ where: { name } });
    if (!supplier) { notMatched++; continue; }
    matched++;

    const vies = viesMap[get("vies_status").toUpperCase()] ?? "UNCHECKED";
    const vat = get("vat_id");
    const disp = get("disposition").toUpperCase();
    if (vies === "VALID") viesValid++;

    const data: { viesStatus: ViesStatus; vatNumber?: string; status?: "QUALIFIED" | "REJECTED" } = { viesStatus: vies };
    if (vat) data.vatNumber = vat;
    if (supplier.status === "CANDIDATE") {
      if (disp === "QUALIFIED") { data.status = "QUALIFIED"; qualified++; }
      else if (disp === "REJECT") { data.status = "REJECTED"; rejected++; }
    }
    await prisma.supplier.update({ where: { id: supplier.id }, data });
    await prisma.note.create({
      data: {
        body: `Квалификация (Фаза A): ${disp} — ${get("why")}. VIES ${get("vies_status")}` +
          `${get("vies_name") ? " (" + get("vies_name") + ")" : ""}. VAT ${vat || "—"}.`,
        entityType: "SUPPLIER",
        entityId: supplier.id,
      },
    });
  }

  revalidatePath("/suppliers");
  revalidatePath("/pipeline");
  return { ok: true, rows: rows.length, matched, qualified, rejected, viesValid, notMatched };
}