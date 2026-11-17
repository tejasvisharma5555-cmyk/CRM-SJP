import Link from "next/link";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { AddPayment } from "@/components/AddPayment";
import { WriteOffToggle, DeletePayment } from "@/components/CommissionActions";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { formatDate, formatMoney, formatPrice } from "@/lib/format";
import type { TKey } from "@/lib/i18n";
import type { CommissionOverview, PaymentMode } from "@/lib/types";

export default async function CommissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t, lang } = await getT();
  const sb = await createClient();
  const [{ data }, { data: payments }, { data: extra }] = await Promise.all([
    sb.from("commission_overview").select("*").eq("id", id).maybeSingle(),
    sb.from("commission_payments").select("id, amount, paid_on, mode, note").eq("commission_id", id).order("paid_on", { ascending: false }),
    sb.from("commissions").select("notes, buyer:contacts!commissions_buyer_contact_id_fkey(id, name)").eq("id", id).maybeSingle(),
  ]);
  if (!data) notFound();
  const c = data as CommissionOverview;
  const ex = extra as unknown as { notes: string | null; buyer: { id: string; name: string } | null } | null;
  const open = c.status === "expected" || c.status === "partially_received";

  return (
    <>
      <TopBar title={t("commission")} back="/commissions" />
      <main className="wrap">
        <Link href={`/properties/${c.property_id}`} className="row" style={{ marginBottom: 10 }}>
          <div className="grow">
            <div className="t1">{t(`type_${c.property_type}` as TKey)} · {c.locality}</div>
            <div className="t2">{c.size_value ? `${Number(c.size_value)} ${t(`unit_${c.size_unit}` as TKey)} · ` : ""}{c.city}</div>
          </div>
          <span>›</span>
        </Link>

        <div className="card">
          <div className="hstack" style={{ justifyContent: "space-between" }}>
            <b>{t(`ctype_${c.type}` as TKey)}</b>
            <span className={`badge ${c.status === "received" ? "ok" : c.status === "written_off" ? "grey" : "warn"}`}>{t(`cstatus_${c.status}` as TKey)}</span>
          </div>
          <div className="muted small" style={{ marginTop: 10 }}>{t("pending")}</div>
          <div className="big-num" data-testid="pending" style={{ color: open && Number(c.pending_amount) > 0 ? "var(--red)" : undefined }}>
            {formatMoney(c.pending_amount)}
          </div>
          <div className="money-strip">
            <div><b>{formatMoney(c.expected_amount)}</b><span>{t("expected")}</span></div>
            <div><b>{formatMoney(c.received_amount)}</b><span>{t("received")}</span></div>
            <div><b>{c.payments_count}</b><span>{t("payments")}</span></div>
          </div>
          <dl className="kv" style={{ marginTop: 12 }}>
            {c.shared_with_name && <><dt>{t("sharedWith")}</dt><dd><Link href={`/contacts/${c.shared_with_contact_id}`}>{c.shared_with_name} ›</Link></dd></>}
            {c.our_share_percent && <><dt>{t("ourPercent")}</dt><dd>{Number(c.our_share_percent)}%</dd></>}
            {c.our_share_amount && <><dt>{t("ourAmount")}</dt><dd>{formatMoney(c.our_share_amount)}</dd></>}
            {c.deal_amount && <><dt>{t("dealAmount")}</dt><dd>{formatPrice(c.deal_amount, lang)}</dd></>}
            {ex?.buyer && <><dt>{t("buyer")}</dt><dd><Link href={`/contacts/${ex.buyer.id}`}>{ex.buyer.name} ›</Link></dd></>}
            <dt>{t("dealDate")}</dt><dd>{formatDate(c.deal_date)}</dd>
          </dl>
          {ex?.notes && <div className="alert warn" style={{ marginTop: 12, marginBottom: 0, fontWeight: 400 }}>🔒 {ex.notes}</div>}
        </div>

        {c.status !== "written_off" && <AddPayment commissionId={c.id} pending={Math.max(0, Number(c.pending_amount))} />}

        <h2>{t("payments")}</h2>
        <div className="list">
          {(payments ?? []).map((p) => (
            <div key={p.id} className="row">
              <div className="grow">
                <div className="t1">{formatMoney(p.amount)}</div>
                <div className="t2">{formatDate(p.paid_on)} · {t(`mode_${p.mode as PaymentMode}` as TKey)}{p.note ? ` · ${p.note}` : ""}</div>
              </div>
              <DeletePayment id={p.id} />
            </div>
          ))}
          {!payments?.length && <div className="empty">{t("none")}</div>}
        </div>

        <div className="stack" style={{ marginTop: 20 }}>
          <Link href={`/commissions/${id}/edit`} className="btn block">✏️ {t("edit")}</Link>
          <WriteOffToggle id={id} writtenOff={c.status === "written_off"} />
        </div>
      </main>
    </>
  );
}
