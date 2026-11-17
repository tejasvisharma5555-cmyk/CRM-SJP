/** Strip characters that have meaning inside a PostgREST or=() filter. */
export function cleanQuery(q: string | undefined | null): string {
  return (q ?? "").replace(/[,()*%\\:"']/g, " ").trim().slice(0, 60);
}

/** Digits a person typed for a phone search, with 0 / 91 prefixes dropped. */
export function phoneDigits(q: string): string {
  let d = q.replace(/\D/g, "");
  if (d.length > 10 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return d;
}

/** PostgREST or() filter matching name or phone. */
export function contactSearchFilter(q: string): string | null {
  const c = cleanQuery(q);
  if (!c) return null;
  const parts = [`name.ilike.*${c}*`];
  const d = phoneDigits(c);
  if (d.length >= 3) parts.push(`phone.ilike.*${d}*`, `alt_phone.ilike.*${d}*`);
  return parts.join(",");
}

/** Build a URL keeping current params, overriding some. */
export function withParams(base: string, current: Record<string, string | undefined>, patch: Record<string, string | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...current, ...patch })) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `${base}?${s}` : base;
}
