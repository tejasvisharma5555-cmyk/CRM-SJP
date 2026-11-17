"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { normalizeIndianPhone, displayPhone } from "@/lib/phone";
import type { BusinessSettings } from "@/lib/settings";
import { useT } from "./I18nProvider";

export function SettingsForm({ initial, canEdit }: { initial: BusinessSettings; canEdit: boolean }) {
  const { t } = useT();
  const router = useRouter();
  const [name, setName] = useState(initial.business_name);
  const [phone, setPhone] = useState(displayPhone(initial.public_phone));
  const [city, setCity] = useState(initial.default_city);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function save() {
    const n = normalizeIndianPhone(phone);
    if (!n) { setMsg({ ok: false, text: t("invalidPhone") }); return; }
    const { error } = await supabaseBrowser().from("business_settings")
      .update({ business_name: name.trim(), public_phone: n, default_city: city.trim() || "Hisar" }).eq("id", true);
    setMsg(error ? { ok: false, text: error.message } : { ok: true, text: t("saved") });
    router.refresh();
  }

  return (
    <div className="card">
      <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
        <div className="field">
          <label className="f" htmlFor="s-name">{t("businessName")}</label>
          <input id="s-name" className="input" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label className="f" htmlFor="s-phone">{t("publicPhone")}</label>
          <input id="s-phone" className="input" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
        </div>
        <div className="field">
          <label className="f" htmlFor="s-city">{t("defaultCity")}</label>
          <input id="s-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
        {msg && <div className={`alert ${msg.ok ? "ok" : "bad"}`}>{msg.text}</div>}
        {canEdit && <button type="button" className="btn primary block lg" onClick={save}>{t("save")}</button>}
      </fieldset>
    </div>
  );
}
