import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { PhotoManager } from "@/components/PhotoManager";
import { LinkSource, UnlinkSource } from "@/components/LinkSource";
import { statusBadge } from "@/components/PropertyRow";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMoney, formatPrice } from "@/lib/format";
import { displayPhone, telLink, whatsappLink } from "@/lib/phone";
import type { TKey } from "@/lib/i18n";
import type { CommissionOverview, ContactLite, ListingSource, Property } from "@/lib/types";

const C = "id, name, phone, area, roles";

export default async function PropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, lang } = await getT();
  const sb = await createClient();

  const [{ data }, { data: sources }, { data: photos }, { data: comm }, settings] = await Promise.all([
    sb.from("properties").select(`*, owner:contacts!properties_owner_contact_id_fkey(${C})`).eq("id", id).maybeSingle(),
    sb.from("property_sources").select(`id, is_primary, listing_source, received_date, quoted_price, contact:contacts(${C})`)
      .eq("property_id", id).order("is_primary", { ascending: false }).order("received_date"),
    sb.from("property_photos").select("id, storage_path").eq("property_id", id).order("sort_order").order("created_at"),
    sb.from("commission_overview").select("*").eq("property_id", id).maybeSingle(),
    getSettings(sb),
  ]);
  if (!data) notFound();
  const p = data as Property & { owner: ContactLite | null };
  const c = comm as CommissionOverview | null;
  type Src = { id: string; is_primary: boolean; listing_source: ListingSource; received_date: string; quoted_price: number | null; contact: ContactLite };
  const srcs = (sources ?? []) as unknown as Src[];

  const paths = (photos ?? []).map((ph) => ph.storage_path as string);
  const signed = paths.length ? (await sb.storage.from("property-photos").createSignedUrls(paths, 3600)).data ?? [] : [];
  const photoList = (photos ?? []).map((ph, i) => ({ id: ph.id as string, path: ph.storage_path as string, url: signed[i]?.signedUrl ?? "" }));

  const title = `${t(`type_${p.property_type}` as TKey)} · ${p.locality}`;
  const shareable = p.status === "available" || p.status === "on_hold";

  return (
    <>
      <TopBar title={title} back="/properties" />
      <main className="wrap">
        <div className="card">
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <span className={`badge ${statusBadge(p.status)}`}>{t(`status_${p.status}` as TKey)}</span>
            <span className="badge grey">{t(`purpose_${p.purpose}` as TKey)}</span>
          </div>
          <div className="big-num" style={{ margin: "6px 0 2px" }}>
            {formatPrice(p.price, lang)}{p.purpose === "rent" ? " / m" : ""}
          </div>
          {p.price && <div className="muted small">{formatMoney(p.price)}{p.price_negotiable ? ` · ${t("negotiable")}` : ""}</div>}
          <dl className="kv" style={{ marginTop: 12 }}>
            <dt>{t("locality")}</dt><dd>{p.locality}, {p.city}</dd>
            {p.plot_no && <><dt>{t("plotNo")}</dt><dd>🔒 {p.plot_no}</dd></>}
            {p.size_value && <><dt>{t("size")}</dt><dd>{Number(p.size_value)} {t(`unit_${p.size_unit}` as TKey)}</dd></>}
            {p.facing && <><dt>{t("facing")}</dt><dd>{p.facing}</dd></>}
            {p.road_width_ft && <><dt>{t("roadWidth")}</dt><dd>{p.road_width_ft}</dd></>}
            <dt>{t("receivedDate")}</dt><dd>{formatDate(p.received_date)}</dd>
            <dt>{t("filterSource")}</dt><dd>{t(`source_${p.listing_source}` as TKey)}</dd>
          </dl>
          {p.notes && <div className="alert warn" style={{ marginTop: 12, marginBottom: 0, fontWeight: 400 }}>🔒 {p.notes}</div>}
        </div>

        <div className="grid2" style={{ marginBottom: 10 }}>
          {shareable
            ? <Link href={`/properties/${id}/share`} className="btn wa lg">💬 {t("share")}</Link>
            : <span className="btn lg" aria-disabled="true" title={t("notShareable")} style={{ opacity: .5 }}>💬 {t("share")}</span>}
          <Link href={`/properties/${id}/edit`} className="btn lg">✏️ {t("edit")}</Link>
        </div>

        <h2>{t("sourceContact")} / {t("alsoListedBy")}</h2>
        <div className="list" style={{ marginBottom: 8 }}>
          {srcs.map((s) => (
            <div key={s.id} className="row">
              <Link href={`/contacts/${s.contact.id}`} className="grow">
                <div className="t1">{s.is_primary ? "⭐ " : ""}{s.contact.name}</div>
                <div className="t2">
                  {t(`source_${s.listing_source}` as TKey)} · {formatDate(s.received_date)}
                  {s.quoted_price ? ` · ${formatPrice(s.quoted_price, lang)}` : ""}
                </div>
              </Link>
              <a className="btn call sm" href={telLink(s.contact.phone)} aria-label={t("call")}>📞</a>
              <a className="btn wa sm" href={whatsappLink(s.contact.phone)} target="_blank" rel="noopener noreferrer" aria-label={t("whatsapp")}>💬</a>
              {!s.is_primary && <UnlinkSource id={s.id} />}
            </div>
          ))}
        </div>
        <LinkSource propertyId={id} defaultCity={settings.default_city} />

        <h2>{t("ownerContact")}</h2>
        {p.owner ? (
          <div className="row">
            <Link href={`/contacts/${p.owner.id}`} className="grow">
              <div className="t1">{p.owner.name}</div>
              <div className="t2">{displayPhone(p.owner.phone)}</div>
            </Link>
            <a className="btn call sm" href={telLink(p.owner.phone)} aria-label={t("call")}>📞</a>
          </div>
        ) : <div className="muted">{t("ownerUnknown")}</div>}

        <h2>{t("photos")} ({photoList.length})</h2>
        <PhotoManager propertyId={id} photos={photoList} />

        <h2>{t("commission")}</h2>
        {c ? (
          <Link href={`/commissions/${c.id}`} className="card" style={{ display: "block" }}>
            <div className="hstack" style={{ justifyContent: "space-between" }}>
              <b>{t(`ctype_${c.type}` as TKey)}{c.shared_with_name ? ` · ${c.shared_with_name}` : ""}</b>
              <span className="badge">{t(`cstatus_${c.status}` as TKey)}</span>
            </div>
            <div className="money-strip">
              <div><b>{formatMoney(c.expected_amount)}</b><span>{t("expected")}</span></div>
              <div><b>{formatMoney(c.received_amount)}</b><span>{t("received")}</span></div>
              <div><b>{formatMoney(c.pending_amount)}</b><span>{t("pending")}</span></div>
            </div>
          </Link>
        ) : (
          <Link href={`/commissions/new?property=${id}`} className="btn primary block lg">₹ {t("addCommission")}</Link>
        )}
      </main>
    </>
  );
}
