import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { PropertyRow, PROPERTY_ROW_SELECT, type PropertyRowData } from "@/components/PropertyRow";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/format";

export default async function Home() {
  const { t, lang } = await getT();
  const supabase = await createClient();

  const [pending, active, recent] = await Promise.all([
    supabase.from("commission_overview").select("pending_amount").in("status", ["expected", "partially_received"]),
    supabase.from("properties").select("id", { count: "exact", head: true }).in("status", ["available", "on_hold"]),
    supabase.from("properties").select(PROPERTY_ROW_SELECT).order("received_date", { ascending: false })
      .order("created_at", { ascending: false }).limit(5),
  ]);
  const totalPending = (pending.data ?? []).reduce((s, r) => s + Math.max(0, Number(r.pending_amount)), 0);

  return (
    <>
      <TopBar title={t("appName")} />
      <main className="wrap">
        <div className="grid2" style={{ marginBottom: 12 }}>
          <Link href="/commissions" className="card" style={{ margin: 0 }}>
            <div className="muted small">{t("totalPending")}</div>
            <div className="big-num" style={{ fontSize: 24 }}>{formatMoney(totalPending)}</div>
          </Link>
          <Link href="/properties" className="card" style={{ margin: 0 }}>
            <div className="muted small">{t("activeListings")}</div>
            <div className="big-num" style={{ fontSize: 24 }}>{active.count ?? 0}</div>
          </Link>
        </div>

        <div className="tiles">
          <Link href="/properties/new" className="tile primary"><span className="ic">➕</span>{t("addProperty")}</Link>
          <Link href="/contacts/new" className="tile primary"><span className="ic">👤</span>{t("addContact")}</Link>
          <Link href="/properties" className="tile"><span className="ic">🏘️</span>{t("properties")}</Link>
          <Link href="/contacts" className="tile"><span className="ic">👥</span>{t("contacts")}</Link>
          <Link href="/commissions" className="tile"><span className="ic">₹</span>{t("commission")}</Link>
          <Link href="/settings" className="tile"><span className="ic">⚙️</span>{t("settings")}</Link>
        </div>

        <h2>{t("recentListings")}</h2>
        <div className="list">
          {(recent.data as unknown as PropertyRowData[] | null)?.map((p) => (
            <PropertyRow key={p.id} p={p} t={t} lang={lang} />
          ))}
          {!recent.data?.length && <div className="empty">{t("none")}</div>}
        </div>
      </main>
    </>
  );
}
