import type { Lang } from "./i18n.ts";

const trim = (n: number) => (Math.round(n * 100) / 100).toString();

/** 5600000 -> "₹56 Lakh" | "₹56 लाख"; 12500000 -> "₹1.25 Cr" | "₹1.25 करोड़"; 15000 -> "₹15,000" */
export function formatPrice(v: number | null | undefined, lang: Lang = "en"): string {
  if (v == null) return "—";
  const n = Number(v);
  if (n >= 1e7) return `₹${trim(n / 1e7)} ${lang === "hi" ? "करोड़" : "Cr"}`;
  if (n >= 1e5) return `₹${trim(n / 1e5)} ${lang === "hi" ? "लाख" : "Lakh"}`;
  return formatMoney(n);
}

/** Exact rupees with Indian grouping: 125000 -> "₹1,25,000" */
export function formatMoney(v: number | null | undefined): string {
  if (v == null) return "—";
  return "₹" + Number(v).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

export function formatDate(d: string | null | undefined): string {
  if (!d) return "—";
  const dt = new Date(d.length === 10 ? d + "T00:00:00" : d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/**
 * Parses what a person types for money. Accepts "56 lakh", "56L", "1.25 cr",
 * "1.25 crore", "56,00,000", "25k". Returns rupees or null.
 */
export function parseAmount(input: string): number | null {
  const s = input.trim().toLowerCase().replace(/,/g, "").replace(/₹|rs\.?/g, "").trim();
  if (!s) return null;
  const m = s.match(/^(\d+(?:\.\d+)?)\s*(cr|crore|crores|करोड़|l|lac|lakh|lakhs|लाख|k|thousand|हज़ार|हजार)?$/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  const u = m[2] ?? "";
  let mult = 1;
  if (["cr", "crore", "crores", "करोड़"].includes(u)) mult = 1e7;
  else if (["l", "lac", "lakh", "lakhs", "लाख"].includes(u)) mult = 1e5;
  else if (["k", "thousand", "हज़ार", "हजार"].includes(u)) mult = 1e3;
  const v = Math.round(n * mult);
  return v > 0 ? v : null;
}
