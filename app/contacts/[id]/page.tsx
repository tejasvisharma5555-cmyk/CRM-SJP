import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { RoleBadges } from "@/components/RoleBadges";
import { PropertyRow, type PropertyRowData } from "@/components/PropertyRow";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { displayPhone, telLink, whatsappLink } from "@/lib/phone";
import { formatMoney } from "@/lib/format";
import type { Contact } from "@/lib/types";

export default async function ContactPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, lang } = await getT();
  const sb = await createClient();

  const [{ data: c }, { data: sources }, { data: summary }] = await Promise.all([
    sb.from("contacts").select("*").eq("id", id).maybeSingle(),
    sb.from("property_sources")
      .select("received_date, listing_source, is_primary, property:properties(id, property_type, purpose, status, locality, city, plot_no, size_value, size_unit, price, listing_source, received_date)")
      .eq("contact_id", id)
      .order("received_date", { ascending: false })
      .limit(200),
    sb.rpc("contact_commission_summary", { p_contact: id }).single(),
  ]);
  if (!c) notFound();
  const contact = c as Contact;
  const sum = summary as { deals: number; expected: number; received: number; pending: number } | null;
  type Src = { received_date: string; property: PropertyRowData | null };
  const props = ((sources ?? []) as unknown as Src[])
    .filter((s) => s.property)
    .map((s) => ({ ...s.property!, received_date: s.received_date }));

  return (
    <>
      <TopBar title={contact.name} back="/contacts" />
      <main className="wrap">
        <div className="card">
          <div style={{ marginBottom: 6 }}><RoleBadges roles={contact.roles} t={t} /></div>
          <div className="big-num" style={{ fontSize: 22 }}>{displayPhone(contact.phone)}</div>
          {contact.alt_phone && <div className="muted">{displayPhone(contact.alt_phone)}</div>}
          {(contact.area || contact.city) && <div className="muted">📍 {[contact.area, contact.city].filter(Boolean).join(", ")}</div>}
          <div className="grid2" style={{ marginTop: 12 }}>
            <a className="btn call lg" href={telLink(contact.phone)}>📞 {t("call")}</a>
            <a className="btn wa lg" href={whatsappLink(contact.phone)} target="_blank" rel="noopener noreferrer">💬 {t("whatsapp")}</a>
          </div>
          {contact.notes && (
            <div className="alert warn" style={{ marginTop: 12, marginBottom: 0, fontWeight: 400 }}>🔒 {contact.notes}</div>
          )}
          <Link href={`/contacts/${id}/edit`} className="btn block sm" style={{ marginTop: 12 }}>✏️ {t("edit")}</Link>
        </div>

        <div className="grid2" style={{ marginBottom: 10 }}>
          <div className="card" style={{ margin: 0 }}>
            <div className="muted small">{t("listingsGiven")}</div>
            <div className="big-num">{contact.listings_count}</div>
          </div>
          <div className="card" style={{ margin: 0 }}>
            <div className="muted small">{t("commissionWith")}</div>
            <div style={{ fontWeight: 750, fontSize: 18 }}>{formatMoney(sum?.pending ?? 0)}</div>
            <div className="muted small">{t("pending")} · {sum?.deals ?? 0} {t("deals")}</div>
          </div>
        </div>
        {sum && Number(sum.deals) > 0 && (
          <div className="card money-strip" style={{ marginTop: 0 }}>
            <div><b>{formatMoney(sum.expected)}</b><span>{t("expected")}</span></div>
            <div><b>{formatMoney(sum.received)}</b><span>{t("received")}</span></div>
            <div><b>{formatMoney(sum.pending)}</b><span>{t("pending")}</span></div>
          </div>
        )}

        <h2>{t("propertiesSupplied")} ({props.length})</h2>
        <div className="list">
          {props.map((p) => <PropertyRow key={p.id} p={p} t={t} lang={lang} showSource={false} />)}
          {!props.length && <div className="empty">{t("none")}</div>}
        </div>
        <Link href={`/properties/new?source=${id}`} className="btn primary block lg" style={{ marginTop: 14 }}>
          ➕ {t("addProperty")}
        </Link>
      </main>
    </>
  );
}
