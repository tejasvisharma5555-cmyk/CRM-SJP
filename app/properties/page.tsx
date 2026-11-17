import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { SearchBox } from "@/components/SearchBox";
import { SelectNav } from "@/components/SelectNav";
import { PropertyRow, PROPERTY_ROW_SELECT, type PropertyRowData } from "@/components/PropertyRow";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { cleanQuery, withParams } from "@/lib/search";
import { PROPERTY_TYPES, STATUSES } from "@/lib/types";
import type { TKey } from "@/lib/i18n";

type SP = { q?: string; source?: string; broker?: string; status?: string; type?: string; n?: string };

export default async function PropertiesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t, lang } = await getT();
  const sb = await createClient();
  const limit = Math.min(Number(sp.n) || 30, 300);
  const status = sp.status ?? "active";

  const select = sp.broker ? `${PROPERTY_ROW_SELECT}, property_sources!inner(contact_id)` : PROPERTY_ROW_SELECT;
  let q = sb.from("properties").select(select, { count: "exact" });
  if (sp.broker) q = q.eq("property_sources.contact_id", sp.broker);
  if (sp.source === "direct_owner" || sp.source === "broker") q = q.eq("listing_source", sp.source);
  if (status === "active") q = q.in("status", ["available", "on_hold"]);
  else if ((STATUSES as string[]).includes(status)) q = q.eq("status", status);
  if (sp.type && (PROPERTY_TYPES as string[]).includes(sp.type)) q = q.eq("property_type", sp.type);
  const c = cleanQuery(sp.q);
  if (c) q = q.or(`locality.ilike.*${c}*,plot_no.ilike.*${c}*,city.ilike.*${c}*`);

  const [{ data, count }, { data: brokers }] = await Promise.all([
    q.order("received_date", { ascending: false }).order("created_at", { ascending: false }).limit(limit),
    sb.from("contacts").select("id, name, listings_count").contains("roles", ["broker"]).gt("listings_count", 0)
      .order("name").limit(500),
  ]);
  const rows = (data ?? []) as unknown as PropertyRowData[];
  const cur = { q: sp.q, source: sp.source, broker: sp.broker, status: sp.status, type: sp.type };

  return (
    <>
      <TopBar title={t("properties")} />
      <main className="wrap">
        <SearchBox placeholder={t("searchLocality")} />

        <div className="chips" style={{ marginBottom: 8 }}>
          {([[undefined, "all"], ["direct_owner", "source_direct_owner"], ["broker", "source_broker"]] as const).map(([v, label]) => (
            <Link key={label} className={`chip ${sp.source === v ? "on" : ""}`}
              href={withParams("/properties", cur, { source: v, broker: v === "direct_owner" ? undefined : sp.broker })}>
              {t(label)}
            </Link>
          ))}
        </div>

        <div className="chips" style={{ marginBottom: 8 }}>
          {(["active", ...STATUSES, "all"] as const).map((s) => (
            <Link key={s} className={`chip ${status === s ? "on" : ""}`} href={withParams("/properties", cur, { status: s === "active" ? undefined : s })}>
              {s === "active" ? t("activeListings") : s === "all" ? t("all") : t(`status_${s}` as TKey)}
            </Link>
          ))}
        </div>

        <div className="grid2" style={{ marginBottom: 12 }}>
          <SelectNav param="broker" value={sp.broker ?? ""} label={t("filterBroker")}
            options={[{ value: "", label: `👤 ${t("anyBroker")}` },
              ...(brokers ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.listings_count})` }))]} />
          <SelectNav param="type" value={sp.type ?? ""} label={t("type")}
            options={[{ value: "", label: `🏠 ${t("all")}` },
              ...PROPERTY_TYPES.map((p) => ({ value: p, label: t(`type_${p}` as TKey) }))]} />
        </div>

        <div className="muted small" style={{ marginBottom: 6 }}>{count ?? 0}</div>
        <div className="list">
          {rows.map((p) => <PropertyRow key={p.id} p={p} t={t} lang={lang} />)}
          {!rows.length && <div className="empty">{t("none")}</div>}
          {count != null && count > rows.length && (
            <Link className="btn block" href={withParams("/properties", cur, { n: String(limit + 30) })} scroll={false}>
              {t("more")} ({count - rows.length})
            </Link>
          )}
        </div>
        <Link href="/properties/new" className="btn primary fab">＋ {t("addProperty")}</Link>
      </main>
    </>
  );
}
