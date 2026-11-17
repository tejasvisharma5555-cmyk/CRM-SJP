import Link from "next/link";
import type { TKey, Lang } from "@/lib/i18n";
import { formatPrice, formatDate } from "@/lib/format";
import type { PropertyStatus, PropertyType, SizeUnit, ListingSource, PropertyPurpose } from "@/lib/types";

export interface PropertyRowData {
  id: string;
  property_type: PropertyType;
  purpose: PropertyPurpose;
  status: PropertyStatus;
  locality: string;
  city: string;
  plot_no: string | null;
  size_value: number | null;
  size_unit: SizeUnit;
  price: number | null;
  listing_source: ListingSource;
  received_date: string;
  source?: { name: string } | null;
}

export const PROPERTY_ROW_SELECT =
  "id, property_type, purpose, status, locality, city, plot_no, size_value, size_unit, price, listing_source, received_date, source:contacts!properties_source_contact_id_fkey(name)";

export function statusBadge(s: PropertyStatus) {
  return s === "available" ? "ok" : s === "on_hold" ? "warn" : "grey";
}

export function PropertyRow({ p, t, lang, showSource = true }: { p: PropertyRowData; t: (k: TKey) => string; lang: Lang; showSource?: boolean }) {
  const size = p.size_value ? `${Number(p.size_value)} ${t(`unit_${p.size_unit}` as TKey)}` : "";
  return (
    <Link href={`/properties/${p.id}`} className="row">
      <div className="grow">
        <div className="t1">
          {t(`type_${p.property_type}` as TKey)}{size && ` · ${size}`} · {p.locality}
        </div>
        <div className="t2">
          {p.plot_no ? `#${p.plot_no} · ` : ""}
          {showSource && p.source?.name ? `${p.source.name} (${t(`source_${p.listing_source}` as TKey)}) · ` : ""}
          {formatDate(p.received_date)}
        </div>
      </div>
      <div className="right">
        <div style={{ fontWeight: 750 }}>{formatPrice(p.price, lang)}{p.purpose === "rent" ? "/m" : ""}</div>
        <span className={`badge ${statusBadge(p.status)}`}>{t(`status_${p.status}` as TKey)}</span>
      </div>
    </Link>
  );
}
