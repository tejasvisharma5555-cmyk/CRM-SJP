"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatMoney, parseAmount, todayISO } from "@/lib/format";
import { PAYMENT_MODES, type PaymentMode } from "@/lib/types";
import { useT } from "./I18nProvider";
import { Sheet } from "./Sheet";
import type { TKey } from "@/lib/i18n";

export function AddPayment({ commissionId, pending, label, compact = false }: {
  commissionId: string; pending: number; label?: string; compact?: boolean;
}) {
  const { t } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amountText, setAmountText] = useState("");
  const [date, setDate] = useState(todayISO());
  const [mode, setMode] = useState<PaymentMode>("cash");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const amount = parseAmount(amountText);

  async function save() {
    if (!amount) { setErr(`${t("amount")}?`); return; }
    setBusy(true);
    const { error } = await supabaseBrowser().from("commission_payments")
      .insert({ commission_id: commissionId, amount, paid_on: date, mode, note: note.trim() || null });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setOpen(false); setAmountText(""); setNote(""); setErr("");
    router.refresh();
  }

  return (
    <>
      <button type="button" className={`btn primary ${compact ? "sm" : "block lg"}`}
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpen(true); }}>
        {compact ? "+ ₹" : `₹ ${label ?? t("addPayment")}`}
      </button>
      {open && (
        <Sheet title={t("addPayment")} onClose={() => setOpen(false)}>
          <div className="field">
            <label className="f" htmlFor="pay-amt">{t("amount")}</label>
            <input id="pay-amt" className={`input ${amountText && !amount ? "err" : ""}`} inputMode="decimal" value={amountText}
              autoFocus placeholder="25000" onChange={(e) => setAmountText(e.target.value)} style={{ fontSize: 22, fontWeight: 700 }} />
            {amount && <div className="hint" style={{ fontWeight: 700 }}>= {formatMoney(amount)}</div>}
            {pending > 0 && (
              <div className="chips" style={{ marginTop: 8 }}>
                <button type="button" className="chip" onClick={() => setAmountText(String(pending))}>
                  {t("pending")}: {formatMoney(pending)}
                </button>
                {pending >= 2000 && (
                  <button type="button" className="chip" onClick={() => setAmountText(String(Math.round(pending / 2)))}>½</button>
                )}
              </div>
            )}
          </div>
          <div className="field">
            <label className="f">{t("mode")}</label>
            <div className="grid2">
              {PAYMENT_MODES.map((m) => (
                <button type="button" key={m} className={`btn ${mode === m ? "primary" : ""}`} onClick={() => setMode(m)}>
                  {t(`mode_${m}` as TKey)}
                </button>
              ))}
            </div>
          </div>
          <div className="grid2">
            <div className="field">
              <label className="f" htmlFor="pay-date">{t("date")}</label>
              <input id="pay-date" className="input" type="date" value={date} max={todayISO()} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="field">
              <label className="f" htmlFor="pay-note">{t("note")} <span className="opt">({t("optional")})</span></label>
              <input id="pay-note" className="input" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          {err && <div className="alert bad">{err}</div>}
          <button type="button" className="btn primary block lg" disabled={busy || !amount} onClick={save}>
            {busy ? t("saving") : t("save")}
          </button>
        </Sheet>
      )}
    </>
  );
}
