// Ядро импорта (без HTTP/файлов) — переиспользуют и UI server-actions (/import),
// и API-эндпоинт /api/import. Один источник логики => нет дрейфа. revalidatePath
// вызывают вызывающие (в request-контексте), здесь — только prisma + подсчёт.
import { LeadSource, Confidence, AuthorizedHint, ViesStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { domainOf, matchSupplierByDomain } from "@/lib/import-dedup";

type Row = Record<string, string>;

const leadMap: Record<string, LeadSource> = {
  brand_page: "BRAND_PAGE", directory: "DIRECTORY", impressum: "IMPRESSUM", search: "SEARCH",
};
const confMap: Record<string, Confidence> = { high: "HIGH", med: "MED", low: "LOW" };
const authMap: Record<string, AuthorizedHint> = { yes: "YES", maybe: "MAYBE", no: "NO" };
const viesMap: Record<string, ViesStatus> = { VALID: "VALID", INVALID: "INVALID" };

export type DistributorCounts = { brands: number; suppliers: number; contacts: number; links: number };
export type QualCounts = { matched: number; qualified: number; rejected: number; viesValid: number; notMatched: number };

export async function importDistributorRows(rows: Row[]): Promise<DistributorCounts> {
  let brands = 0, suppliers = 0, contacts = 0, links = 0;
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
      // точный матч по домену (иначе acme.com слепится с myacme.com)
      const existing = dom
        ? matchSupplierByDomain(await prisma.supplier.findMany({ where: { website: { contains: dom } } }), dom)
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
        await prisma.contact.create({ data: { supplierId, name: email.split("@")[0], email, isPrimary: true } });
        contacts++;
      }
    }

    if (supplierId && brandId) {
      await prisma.supplierBrand.upsert({
        where: { supplierId_brandId: { supplierId, brandId } },
        update: {},
        create: {
          supplierId, brandId,
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
  return { brands, suppliers, contacts, links };
}

export async function importQualificationRows(rows: Row[]): Promise<QualCounts> {
  let matched = 0, qualified = 0, rejected = 0, viesValid = 0, notMatched = 0;

  for (const r of rows) {
    const get = (k: string) => (r[k] ?? "").trim();
    const website = get("website");
    const name = get("supplier");
    if (!website && !name) continue;

    const dom = domainOf(website);
    let supplier: Awaited<ReturnType<typeof prisma.supplier.findFirst>> = null;
    if (dom) {
      supplier = matchSupplierByDomain(await prisma.supplier.findMany({ where: { website: { contains: dom } } }), dom);
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
  return { matched, qualified, rejected, viesValid, notMatched };
}
