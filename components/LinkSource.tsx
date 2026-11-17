"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { parseAmount, formatPrice, todayISO } from "@/lib/format";
import type { ContactLite, ListingSource } from "@/lib/types";
import { useT } from "./I18nProvider";
import { ContactPicker } from "./ContactPicker";
import { Sheet } from "./Sheet";

/** "+ Another broker has this" — link one more source to an existing property. */
export function LinkSource({ propertyId, defaultCity }: { propertyId: string; defaultCity: string }) {
  const { t, lang } = useT();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [contact, setContact] = useState<ContactLite | null>(null);
  const [src, setSrc] = useState<ListingSource>("broker");
  const [priceText, setPriceText] = useState("");
  const [received, setReceived] = useState(todayISO());
  const [err, setErr] = useState("");
  const price = parseAmount(priceText);

  async function save() {
    if (!contact) return;
    const { error } = await supabaseBrowser().from("property_sources").upsert(
      { property_id: propertyId, contact_id: contact.id, listing_source: src, quoted_price: price, received_date: received },
      { onConflict: "property_id,contact_id" });
    if (error) { setErr(error.message); return; }
    setOpen(false); setContact(null); setPriceText("");
    router.refresh();
  }

  return (
    <>
      <button type="button" className="btn block" onClick={() => setOpen(true)}>{t("linkBroker")}</button>
      {open && (
        <Sheet title={t("alsoListedBy")} onClose={() => setOpen(false)}>
          <div className="field">
            <div className="grid2">
              {(["broker", "direct_owner"] as const).map((s) => (
                <button key={s} type="button" className={`btn ${src === s ? "primary" : ""}`} onClick={() => setSrc(s)}>{t(`source_${s}`)}</button>
              ))}
            </div>
          </div>
          <div className="field">
            <ContactPicker label={t("sourceContact")} value={contact} onChange={setContact} defaultCity={defaultCity}
              defaultRoles={[src === "broker" ? "broker" : "owner"]} preferRole={src === "broker" ? "broker" : "owner"} />
          </div>
          <div className="grid2">
            <div className="field">
              <label className="f" htmlFor="ls-price">{t("quotedPrice")} <span className="opt">({t("optional")})</span></label>
              <input id="ls-price" className="input" value={priceText} placeholder="55 lakh" onChange={(e) => setPriceText(e.target.value)} />
              {price && <div className="hint">= {formatPrice(price, lang)}</div>}
            </div>
            <div className="field">
              <label className="f" htmlFor="ls-date">{t("receivedDate")}</label>
              <input id="ls-date" className="input" type="date" value={received} onChange={(e) => setReceived(e.target.value)} />
            </div>
          </div>
          {err && <div className="alert bad">{err}</div>}
          <button type="button" className="btn primary block lg" disabled={!contact} onClick={save}>{t("save")}</button>
        </Sheet>
      )}
    </>
  );
}

export function UnlinkSource({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  return (
    <button type="button" className="btn sm danger" aria-label={t("delete")} onClick={async () => {
      if (!confirm(`${t("delete")}?`)) return;
      await supabaseBrowser().from("property_sources").delete().eq("id", id).eq("is_primary", false);
      router.refresh();
    }}>✕</button>
  );
}
