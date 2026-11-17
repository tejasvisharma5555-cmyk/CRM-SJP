"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatMoney, formatPrice, parseAmount, todayISO } from "@/lib/format";
import type { CommissionType, ContactLite } from "@/lib/types";
import { useT } from "./I18nProvider";
import { ContactPicker } from "./ContactPicker";

export interface CommissionInitial {
  id?: string;
  property_id: string;
  type?: CommissionType;
  shared_with?: ContactLite | null;
  buyer?: ContactLite | null;
  deal_amount?: number | null;
  our_share_percent?: number | null;
  our_share_amount?: number | null;
  expected_amount?: number | null;
  deal_date?: string;
  notes?: string | null;
}

export function CommissionForm({ initial, defaultCity, propertyPrice }: {
  initial: CommissionInitial; defaultCity: string; propertyPrice: number | null;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const [type, setType] = useState<CommissionType>(initial.type ?? "direct");
  const [sharedWith, setSharedWith] = useState<ContactLite | null>(initial.shared_with ?? null);
  const [buyer, setBuyer] = useState<ContactLite | null>(initial.buyer ?? null);
  const [dealText, setDealText] = useState(String(initial.deal_amount ?? propertyPrice ?? ""));
  const [basis, setBasis] = useState<"percent" | "amount">(initial.our_share_amount ? "amount" : "percent");
  const [percent, setPercent] = useState(String(initial.our_share_percent ?? (initial.id ? "" : "50")));
  const [shareAmtText, setShareAmtText] = useState(initial.our_share_amount ? String(initial.our_share_amount) : "");
  const [expectedText, setExpectedText] = useState(initial.expected_amount != null ? String(initial.expected_amount) : "");
  const [dealDate, setDealDate] = useState(initial.deal_date ?? todayISO());
  const [notes, setNotes] = useState(initial.notes ?? "");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const deal = parseAmount(dealText);
  const expected = parseAmount(expectedText);
  const shareAmt = parseAmount(shareAmtText);
  const pct = percent ? Number(percent) : null;

  /** Quick fill: X% of deal value as total commission, then our share of it. */
  function fillFromRate(rate: number) {
    if (!deal) return;
    const total = (deal * rate) / 100;
    const ours = type === "shared" && basis === "percent" && pct ? (total * pct) / 100 : total;
    setExpectedText(String(Math.round(ours)));
  }

  async function save() {
    if (type === "shared" && !sharedWith) { setErr(`${t("sharedWith")}: ${t("required")}`); return; }
    if (type === "shared" && basis === "percent" && !(pct && pct > 0 && pct <= 100)) { setErr(`${t("ourPercent")}?`); return; }
    const exp = type === "shared" && basis === "amount" ? shareAmt : expected;
    if (exp == null) { setErr(`${t("expected")}: ${t("required")}`); return; }
    setBusy(true);
    const row = {
      property_id: initial.property_id,
      type,
      shared_with_contact_id: type === "shared" ? sharedWith!.id : null,
      buyer_contact_id: buyer?.id ?? null,
      deal_amount: deal,
      our_share_percent: type === "shared" && basis === "percent" ? pct : null,
      our_share_amount: type === "shared" && basis === "amount" ? shareAmt : null,
      expected_amount: exp,
      deal_date: dealDate,
      notes: notes.trim() || null,
    };
    const sb = supabaseBrowser();
    const res = initial.id
      ? await sb.from("commissions").update(row).eq("id", initial.id).select("id").single()
      : await sb.from("commissions").insert(row).select("id").single();
    setBusy(false);
    if (res.error) {
      setErr(res.error.code === "23505" ? t("hasCommission") : `${t("error")}: ${res.error.message}`);
      return;
    }
    router.push(`/commissions/${res.data.id}`);
    router.refresh();
  }

  return (
    <div className="card">
      <div className="field">
        <label className="f">{t("commissionType")}</label>
        <div className="grid2">
          {(["direct", "shared"] as const).map((c) => (
            <button key={c} type="button" className={`btn lg ${type === c ? "primary" : ""}`} onClick={() => setType(c)}>
              {t(`ctype_${c}`)}
            </button>
          ))}
        </div>
      </div>

      {type === "shared" && (
        <div className="field">
          <label className="f">{t("sharedWith")}</label>
          <ContactPicker label={t("sharedWith")} value={sharedWith} onChange={setSharedWith} defaultCity={defaultCity}
            defaultRoles={["broker"]} preferRole="broker" />
        </div>
      )}

      <div className="field">
        <label className="f" htmlFor="cm-deal">{t("dealAmount")} <span className="opt">({t("optional")})</span></label>
        <input id="cm-deal" className="input" value={dealText} onChange={(e) => setDealText(e.target.value)} placeholder="55 lakh" />
        {deal && <div className="hint">= {formatPrice(deal, lang)}</div>}
      </div>

      {type === "shared" && (
        <div className="field">
          <div className="chips" style={{ marginBottom: 8 }}>
            <button type="button" className={`chip ${basis === "percent" ? "on" : ""}`} onClick={() => setBasis("percent")}>{t("ourPercent")}</button>
            <button type="button" className={`chip ${basis === "amount" ? "on" : ""}`} onClick={() => setBasis("amount")}>{t("ourAmount")}</button>
          </div>
          {basis === "percent" ? (
            <input aria-label={t("ourPercent")} className="input" type="number" inputMode="decimal" min="1" max="100" value={percent}
              onChange={(e) => setPercent(e.target.value)} />
          ) : (
            <input aria-label={t("ourAmount")} className="input" value={shareAmtText} onChange={(e) => setShareAmtText(e.target.value)} />
          )}
        </div>
      )}

      {!(type === "shared" && basis === "amount") && (
        <div className="field">
          <label className="f" htmlFor="cm-exp">{t("expected")} ₹</label>
          <input id="cm-exp" className="input" inputMode="decimal" value={expectedText} onChange={(e) => setExpectedText(e.target.value)}
            style={{ fontSize: 20, fontWeight: 700 }} />
          {expected != null && <div className="hint" style={{ fontWeight: 700 }}>= {formatMoney(expected)}</div>}
          {deal && (
            <div className="chips" style={{ marginTop: 8 }}>
              {[1, 2].map((r) => (
                <button key={r} type="button" className="chip" onClick={() => fillFromRate(r)}>
                  {r}%{type === "shared" && basis === "percent" && pct ? ` × ${pct}%` : ""}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="field">
        <label className="f">{t("buyer")} <span className="opt">({t("optional")})</span></label>
        <ContactPicker label={t("buyer")} value={buyer} onChange={setBuyer} defaultCity={defaultCity} defaultRoles={["buyer"]} preferRole="buyer" />
      </div>

      <div className="field">
        <label className="f" htmlFor="cm-date">{t("dealDate")}</label>
        <input id="cm-date" className="input" type="date" value={dealDate} onChange={(e) => setDealDate(e.target.value)} />
      </div>
      <div className="field">
        <label className="f" htmlFor="cm-notes">🔒 {t("notes")}</label>
        <textarea id="cm-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>

      {err && <div className="alert bad">{err}</div>}
      <button type="button" className="btn primary block lg" disabled={busy} onClick={save}>{busy ? t("saving") : t("save")}</button>
    </div>
  );
}
