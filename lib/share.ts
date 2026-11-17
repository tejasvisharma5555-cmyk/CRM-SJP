import type { PublicPropertyCard } from "./types.ts";
import { formatPrice } from "./format.ts";
import { displayPhone } from "./phone.ts";
import { translator, type Lang } from "./i18n.ts";

export interface ShareOptions {
  lang: Lang;
  includePlotNo: boolean; // default OFF in the UI
}

/**
 * Builds the WhatsApp text for a property.
 *
 * PRIVACY: input is the `public_property_card` view row. We additionally copy
 * out an explicit allow-list of fields, so even if a wider object were ever
 * passed in at runtime (e.g. a full property row with notes/owner), nothing
 * outside this list can reach the message.
 */
export function buildShareMessage(card: PublicPropertyCard, opts: ShareOptions): string {
  const safe = {
    property_type: card.property_type,
    purpose: card.purpose,
    city: card.city,
    locality: card.locality,
    plot_no: opts.includePlotNo ? card.plot_no : null,
    size_value: card.size_value,
    size_unit: card.size_unit,
    price: card.price,
    price_negotiable: card.price_negotiable,
    business_name: card.business_name,
    public_phone: card.public_phone,
  };
  const t = translator(opts.lang);
  const hi = opts.lang === "hi";

  const typeLabel = t(`type_${safe.property_type}`);
  const purposeLabel = t(`purpose_${safe.purpose}`);
  const lines: string[] = [];

  lines.push(hi
    ? `🏠 ${typeLabel} ${safe.purpose === "rent" ? "किराये पर" : "बिकाऊ"}`
    : `🏠 ${typeLabel} for ${purposeLabel}`);
  lines.push(`📍 ${[safe.locality, safe.city].filter(Boolean).join(", ")}`);
  if (safe.plot_no) lines.push(hi ? `🔢 प्लॉट नं. ${safe.plot_no}` : `🔢 Plot No. ${safe.plot_no}`);
  if (safe.size_value) {
    const size = Number(safe.size_value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
    lines.push(`📐 ${size} ${t(`unit_${safe.size_unit}`)}`);
  }
  if (safe.price) {
    let p = formatPrice(safe.price, opts.lang);
    if (safe.purpose === "rent") p += hi ? " / महीना" : " / month";
    if (safe.price_negotiable) p += hi ? " (मोलभाव संभव)" : " (negotiable)";
    lines.push(`💰 ${p}`);
  }
  lines.push("");
  lines.push(`📞 ${safe.business_name}: ${displayPhone(safe.public_phone)}`);
  return lines.join("\n");
}
