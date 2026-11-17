"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { contactSearchFilter, phoneDigits } from "@/lib/search";
import { displayPhone } from "@/lib/phone";
import type { ContactLite, ContactRole } from "@/lib/types";
import { useT } from "./I18nProvider";
import { ContactForm } from "./ContactForm";
import { Sheet } from "./Sheet";
import type { TKey } from "@/lib/i18n";

/**
 * Pick an existing contact by name/phone, or create one in a sheet —
 * without leaving the form underneath.
 */
export function ContactPicker({ value, onChange, defaultRoles, preferRole, defaultCity, label }: {
  value: ContactLite | null;
  onChange: (c: ContactLite | null) => void;
  defaultRoles: ContactRole[];
  preferRole?: ContactRole;
  defaultCity: string;
  label: string;
}) {
  const { t } = useT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ContactLite[]>([]);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const f = contactSearchFilter(q);
    if (!f) { setResults([]); return; }
    const id = setTimeout(async () => {
      let query = supabaseBrowser().from("contacts").select("id, name, phone, area, roles").or(f);
      query = preferRole
        ? query.order("listings_count", { ascending: false })
        : query.order("name");
      const { data } = await query.limit(8);
      const rows = (data ?? []) as ContactLite[];
      // brokers first when picking a broker, etc.
      if (preferRole) rows.sort((a, b) => Number(b.roles.includes(preferRole)) - Number(a.roles.includes(preferRole)));
      setResults(rows);
    }, 250);
    return () => clearTimeout(id);
  }, [q, preferRole]);

  if (value) {
    return (
      <div className="row" style={{ borderColor: "var(--primary)" }}>
        <div className="grow">
          <div className="t1">✓ {value.name}</div>
          <div className="t2">{displayPhone(value.phone)}{value.area ? ` · ${value.area}` : ""}</div>
        </div>
        <button type="button" className="btn sm" onClick={() => { onChange(null); setQ(""); }}>{t("change")}</button>
      </div>
    );
  }

  const digits = phoneDigits(q);
  const looksLikePhone = digits.length >= 6 && digits.length >= q.replace(/\s/g, "").length - 3;

  return (
    <div>
      <div className="searchbar" style={{ marginBottom: 6 }}>
        <input className="input" type="search" aria-label={label} placeholder={t("pickContact")} value={q}
          onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      {results.length > 0 && (
        <div className="list" style={{ marginBottom: 6 }}>
          {results.map((c) => (
            <button type="button" key={c.id} className="row" style={{ textAlign: "left", font: "inherit", color: "inherit", cursor: "pointer" }}
              onClick={() => onChange(c)}>
              <div className="grow">
                <div className="t1">{c.name}</div>
                <div className="t2">
                  {displayPhone(c.phone)} · {c.roles.map((r) => t(`role_${r}` as TKey)).join(", ")}{c.area ? ` · ${c.area}` : ""}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
      {q.trim() && !results.length && <div className="hint" style={{ marginBottom: 6 }}>{t("noContactFound")}</div>}
      <button type="button" className="btn block" onClick={() => setCreating(true)}>{t("createContact")}</button>

      {creating && (
        <Sheet title={t("newContact")} onClose={() => setCreating(false)}>
          <ContactForm
            defaultRoles={defaultRoles}
            defaultCity={defaultCity}
            initial={looksLikePhone ? { phone: digits } : q.trim() ? { name: q.trim() } : undefined}
            onDone={(c) => { setCreating(false); onChange(c); }}
            onCancel={() => setCreating(false)}
          />
        </Sheet>
      )}
    </div>
  );
}
