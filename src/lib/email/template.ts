export type TemplateVars = { brand: string; contact: string; openingHook?: string };

const RESOLVERS: Record<string, (v: TemplateVars) => string> = {
  brand: (v) => v.brand,
  contact_name_or_team: (v) => v.contact,
  opening_hook: (v) => v.openingHook ?? "",
};

export function renderTemplate(src: string, vars: TemplateVars): string {
  const out = src.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => RESOLVERS[key]?.(vars) ?? "");
  // collapse blank-paragraph runs left by an empty opening_hook
  return out.replace(/\n{3,}/g, "\n\n").trim();
}

export function ensureRe(subject: string): string {
  const s = subject.trim();
  return /^re:/i.test(s) ? s : `Re: ${s}`;
}

export function textToHtml(text: string): string {
  const esc = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return esc
    .split(/\n{2,}/)
    .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
    .join("\n");
}
