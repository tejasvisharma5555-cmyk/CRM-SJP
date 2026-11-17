import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { AddPayment } from "@/components/AddPayment";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney } from "@/lib/format";
import type { TKey } from "@/lib/i18n";
import type { CommissionOverview } from "@/lib/types";

type SP = { status?: string };
const FILTERS = ["pending", "received", "written_off", "all"] as const;

export default async function CommissionsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const filter = (FILTERS as readonly string[]).includes(sp.status ?? "") ? sp.status! : "pending";
  const { t } = await getT();
  const sb = await createClient();

  let q = sb.from("commission_overview").select("*");
  if (filter === "pending") q = q.in("status", ["expected", "partially_received"]);
  else if (filter !== "all") q = q.eq("status", filter);
  const [{ data }, { data: open }] = await Promise.all([
    q.order("deal_date", { ascending: false }).limit(300),
    sb.from("commission_overview").select("expected_amount, received_amount, pending_amount").in("status", ["expected", "partially_received"]),
  ]);
  const rows = (data ?? []) as CommissionOverview[];
  const totalPending = (open ?? []).reduce((s, r) => s + Math.max(0, Number(r.pending_amount)), 0);
  const label = (f: string) => f === "pending" ? t("pending") : f === "all" ? t("all") : t(`cstatus_${f}` as TKey);

  return (
    <>
      <TopBar title={t("commission")} />
      <main className="wrap">
        <div className="card" style={{ background: "var(--primary)", color: "var(--primary-ink)", borderColor: "var(--primary)" }}>
          <div style={{ opacity: .85 }}>{t("totalPending")}</div>
          <div className="big-num" data-testid="total-pending">{formatMoney(totalPending)}</div>
          <div style={{ opacity: .85 }} className="small">{(open ?? []).length} {t("deals")}</div>
        </div>

        <div className="chips" style={{ marginBottom: 12 }}>
          {FILTERS.map((f) => (
            <Link key={f} href={f === "pending" ? "/commissions" : `/commissions?status=${f}`} className={`chip ${filter === f ? "on" : ""}`}>
              {label(f)}
            </Link>
          ))}
        </div>

        <div className="list">
          {rows.map((c) => (
            <div key={c.id} className="card" style={{ margin: 0 }}>
              <div className="hstack" style={{ justifyContent: "space-between", flexWrap: "nowrap" }}>
                <Link href={`/commissions/${c.id}`} style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>
                    {t(`type_${c.property_type}` as TKey)}{c.size_value ? ` · ${Number(c.size_value)} ${t(`unit_${c.size_unit}` as TKey)}` : ""} · {c.locality}
                  </div>
                  <div className="muted small">
                    {c.shared_with_name ? `🤝 ${c.shared_with_name} · ` : ""}{formatDate(c.deal_date)} ·{" "}
                    <span className={`badge ${c.status === "received" ? "ok" : c.status === "written_off" ? "grey" : "warn"}`}>
                      {t(`cstatus_${c.status}` as TKey)}
                    </span>
                  </div>
                </Link>
                {(c.status === "expected" || c.status === "partially_received") && (
                  <AddPayment commissionId={c.id} pending={Number(c.pending_amount)} compact />
                )}
              </div>
              <Link href={`/commissions/${c.id}`} className="money-strip">
                <div><b>{formatMoney(c.expected_amount)}</b><span>{t("expected")}</span></div>
                <div><b>{formatMoney(c.received_amount)}</b><span>{t("received")}</span></div>
                <div><b style={{ color: Number(c.pending_amount) > 0 && c.status !== "written_off" ? "var(--red)" : undefined }}>
                  {formatMoney(c.pending_amount)}</b><span>{t("pending")}</span></div>
              </Link>
            </div>
          ))}
          {!rows.length && <div className="empty">{t("none")}</div>}
        </div>
      </main>
    </>
  );
}
