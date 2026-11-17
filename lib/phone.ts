// Mirrors public.normalize_in_phone() in the database. The DB trigger is the
// final authority; this copy gives instant feedback while typing.

export function normalizeIndianPhone(input: string | null | undefined): string | null {
  if (!input || !input.trim()) return null;
  let d = input.replace(/[\s\-.()]/g, "");
  if (d.startsWith("+91")) d = d.slice(3);
  else if (d.startsWith("0091")) d = d.slice(4);
  else if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
  if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
  return /^[6-9]\d{9}$/.test(d) ? "+91" + d : null;
}

/** "+919812012345" -> "98120 12345" */
export function displayPhone(p: string | null | undefined): string {
  if (!p) return "";
  const d = p.replace(/^\+91/, "");
  return d.length === 10 ? `${d.slice(0, 5)} ${d.slice(5)}` : p;
}

export function telLink(p: string): string {
  return `tel:${p}`;
}

/** wa.me wants digits only, with country code. */
export function whatsappLink(p: string, text?: string): string {
  const digits = p.replace(/\D/g, "");
  return `https://wa.me/${digits}${text ? `?text=${encodeURIComponent(text)}` : ""}`;
}

/** WhatsApp share without a fixed recipient (user picks the chat). */
export function whatsappShareLink(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
