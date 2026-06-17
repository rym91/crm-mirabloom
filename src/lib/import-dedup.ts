// Дедуп поставщиков при импорте: нормализация домена + ТОЧНЫЙ матч по домену.
// Раньше supplier-lookup делал website:{contains:dom} (подстрока) -> dom "acme.com"
// слепляется с "myacme.com" / "oracdecor.com" vs "oracdecor.com.es" и привязывал бренд
// к чужому поставщику. Здесь домен сравнивается строго (host-equality).

export function domainOf(url?: string | null): string | null {
  if (!url) return null;
  const raw = url.trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    return u.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return raw.toLowerCase();
  }
}

// Из набора кандидатов (отобранных грубым contains-запросом по БД) выбирает того,
// у кого нормализованный домен сайта ТОЧНО равен dom. null, если точного нет.
export function matchSupplierByDomain<T extends { website: string | null }>(
  suppliers: T[],
  dom: string
): T | null {
  for (const s of suppliers) {
    if (domainOf(s.website) === dom) return s;
  }
  return null;
}
