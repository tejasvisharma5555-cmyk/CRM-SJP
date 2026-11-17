"use client";
import { useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { normalizeIndianPhone, displayPhone } from "@/lib/phone";
import { ROLES, type Contact, type ContactLite, type ContactRole } from "@/lib/types";
import { useT } from "./I18nProvider";
import type { TKey } from "@/lib/i18n";

type Similar = { id: string; name: string; phone: string; area: string | null };

interface Props {
  initial?: Partial<Contact>;
  defaultRoles?: ContactRole[];
  defaultCity?: string;
  /** inline mode (inside property form): called with the saved OR picked contact */
  onDone?: (c: ContactLite) => void;
  onCancel?: () => void;
  /** page mode: where to go after save */
  afterSave?: (id: string) => void;
}

const COLS = "id, name, phone, area, roles";

export function ContactForm({ initial, defaultRoles = [], defaultCity = "", onDone, onCancel, afterSave }: Props) {
  const { t } = useT();
  const sb = supabaseBrowser();
  const editingId = initial?.id;

  const [name, setName] = useState(initial?.name ?? "");
  const [phone, setPhone] = useState(initial?.phone ? displayPhone(initial.phone) : "");
  const [altPhone, setAltPhone] = useState(initial?.alt_phone ? displayPhone(initial.alt_phone) : "");
  const [city, setCity] = useState(initial?.city ?? defaultCity);
  const [area, setArea] = useState(initial?.area ?? "");
  const [roles, setRoles] = useState<ContactRole[]>(initial?.roles ?? defaultRoles);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [more, setMore] = useState(Boolean(initial?.alt_phone || initial?.notes));

  const [phoneErr, setPhoneErr] = useState("");
  const [existing, setExisting] = useState<ContactLite | null>(null);
  const [similar, setSimilar] = useState<Similar[]>([]);
  const [similarAck, setSimilarAck] = useState(false);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function checkPhone(raw: string): Promise<ContactLite | null | false> {
    const n = normalizeIndianPhone(raw);
    if (!n) { setPhoneErr(t("invalidPhone")); return false; }
    setPhoneErr("");
    const { data } = await sb.rpc("find_contact_by_phone", { p_phone: n }).select(COLS);
    const hit = (data as ContactLite[] | null)?.[0];
    if (hit && hit.id !== editingId) { setExisting(hit); return hit; }
    setExisting(null);
    return null;
  }

  function toggleRole(r: ContactRole) {
    setRoles((cur) => (cur.includes(r) ? cur.filter((x) => x !== r) : [...cur, r]));
  }

  async function save() {
    setErr("");
    if (!name.trim()) { setErr(t("nameRequired")); return; }
    if (!roles.length) { setErr(t("pickRole")); return; }
    if (altPhone.trim() && !normalizeIndianPhone(altPhone)) { setErr(`${t("altPhone")}: ${t("invalidPhone")}`); return; }
    setBusy(true);
    try {
      const dup = await checkPhone(phone);
      if (dup !== null) return; // invalid or already saved → blocked

      if (!similarAck && area.trim()) {
        const { data } = await sb.rpc("find_similar_contacts", { p_name: name.trim(), p_area: area.trim(), p_exclude: editingId ?? null });
        if (data?.length) { setSimilar(data as Similar[]); setSimilarAck(true); return; }
      }

      const row = {
        name: name.trim(),
        phone: normalizeIndianPhone(phone),
        alt_phone: normalizeIndianPhone(altPhone),
        city: city.trim() || null,
        area: area.trim() || null,
        roles,
        notes: notes.trim() || null,
      };
      const res = editingId
        ? await sb.from("contacts").update(row).eq("id", editingId).select(COLS).single()
        : await sb.from("contacts").insert(row).select(COLS).single();
      if (res.error) {
        if (res.error.code === "23505") { await checkPhone(phone); return; } // someone saved it meanwhile
        setErr(res.error.message.includes("invalid_phone") ? t("invalidPhone") : t("error"));
        return;
      }
      const saved = res.data as ContactLite;
      if (onDone) onDone(saved);
      else afterSave?.(saved.id);
    } finally {
      setBusy(false);
    }
  }

  const normalized = normalizeIndianPhone(phone);

  return (
    <div>
      <div className="field">
        <label className="f" htmlFor="c-phone">{t("phone")}</label>
        <input id="c-phone" className={`input ${phoneErr || existing ? "err" : ""}`} type="tel" inputMode="tel"
          autoComplete="off" value={phone} placeholder="98XXX XXXXX"
          onChange={(e) => { setPhone(e.target.value); setExisting(null); setPhoneErr(""); }}
          onBlur={() => phone.trim() && checkPhone(phone)} />
        {normalized && !existing && !phoneErr && <div className="hint">✓ {displayPhone(normalized)}</div>}
        {phoneErr && <div className="errtext">{phoneErr}</div>}
      </div>

      {existing && (
        <div className="alert warn">
          {t("alreadySaved")} <b>{existing.name}</b> ({displayPhone(existing.phone)})
          <div className="hstack" style={{ marginTop: 8 }}>
            {onDone
              ? <button type="button" className="btn primary sm" onClick={() => onDone(existing)}>{t("useThis")}</button>
              : <Link className="btn primary sm" href={`/contacts/${existing.id}`}>{t("open")}</Link>}
          </div>
        </div>
      )}

      <div className="field">
        <label className="f" htmlFor="c-name">{t("name")}</label>
        <input id="c-name" className="input" value={name} autoComplete="off"
          onChange={(e) => { setName(e.target.value); setSimilarAck(false); setSimilar([]); }} />
      </div>

      <div className="field">
        <label className="f">{t("roles")}</label>
        <div className="chips wrapchips">
          {ROLES.map((r) => (
            <button type="button" key={r} className={`chip ${roles.includes(r) ? "on" : ""}`} onClick={() => toggleRole(r)}>
              {roles.includes(r) ? "✓ " : ""}{t(`role_${r}` as TKey)}
            </button>
          ))}
        </div>
      </div>

      <div className="grid2">
        <div className="field">
          <label className="f" htmlFor="c-area">{t("area")} <span className="opt">({t("optional")})</span></label>
          <input id="c-area" className="input" value={area}
            onChange={(e) => { setArea(e.target.value); setSimilarAck(false); setSimilar([]); }} />
        </div>
        <div className="field">
          <label className="f" htmlFor="c-city">{t("city")}</label>
          <input id="c-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      {!more && <button type="button" className="btn sm" style={{ marginBottom: 14 }} onClick={() => setMore(true)}>＋ {t("altPhone")} / {t("notes")}</button>}
      {more && (
        <>
          <div className="field">
            <label className="f" htmlFor="c-alt">{t("altPhone")} <span className="opt">({t("optional")})</span></label>
            <input id="c-alt" className="input" type="tel" inputMode="tel" value={altPhone} onChange={(e) => setAltPhone(e.target.value)} />
          </div>
          <div className="field">
            <label className="f" htmlFor="c-notes">🔒 {t("notes")}</label>
            <textarea id="c-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="hint">{t("notesHint")}</div>
          </div>
        </>
      )}

      {similar.length > 0 && (
        <div className="alert warn">
          {t("similarName")}
          <div className="stack" style={{ marginTop: 8 }}>
            {similar.map((s) => (
              <div key={s.id} className="hstack" style={{ justifyContent: "space-between" }}>
                <span><b>{s.name}</b> · {displayPhone(s.phone)}</span>
                {onDone
                  ? <button type="button" className="btn sm" onClick={async () => {
                      const { data } = await sb.from("contacts").select(COLS).eq("id", s.id).single();
                      if (data) onDone(data as ContactLite);
                    }}>{t("useThis")}</button>
                  : <Link className="btn sm" href={`/contacts/${s.id}`}>{t("open")}</Link>}
              </div>
            ))}
          </div>
        </div>
      )}

      {err && <div className="alert bad">{err}</div>}
      <div className="stack">
        <button type="button" className="btn primary block lg" disabled={busy || !!existing} onClick={save}>
          {busy ? t("saving") : similar.length ? t("saveAnyway") : t("save")}
        </button>
        {onCancel && <button type="button" className="btn block" onClick={onCancel}>{t("cancel")}</button>}
      </div>
    </div>
  );
}
