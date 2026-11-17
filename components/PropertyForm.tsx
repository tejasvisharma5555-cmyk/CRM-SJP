"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { formatPrice, formatDate, parseAmount, todayISO } from "@/lib/format";
import {
  PROPERTY_TYPES, STATUSES, UNITS,
  type ContactLite, type DuplicateMatch, type ListingSource, type Property,
  type PropertyPurpose, type PropertyStatus, type PropertyType, type SizeUnit,
} from "@/lib/types";
import { useT } from "./I18nProvider";
import { ContactPicker } from "./ContactPicker";
import { Sheet } from "./Sheet";
import type { TKey } from "@/lib/i18n";

interface Props {
  initial?: Property;
  initialSource?: ContactLite | null;
  initialOwner?: ContactLite | null;
  defaultCity: string;
  localities: string[];
}

export function PropertyForm({ initial, initialSource = null, initialOwner = null, defaultCity, localities }: Props) {
  const { t, lang } = useT();
  const router = useRouter();
  const sb = supabaseBrowser();
  const editing = Boolean(initial);

  const [listingSource, setListingSource] = useState<ListingSource>(
    initial?.listing_source ?? (initialSource?.roles.includes("broker") ? "broker" : "direct_owner"));
  const [source, setSource] = useState<ContactLite | null>(initialSource);
  const [owner, setOwner] = useState<ContactLite | null>(
    initial?.listing_source === "broker" ? initialOwner : null);
  const [ptype, setPtype] = useState<PropertyType>(initial?.property_type ?? "plot");
  const [purpose, setPurpose] = useState<PropertyPurpose>(initial?.purpose ?? "sale");
  const [status, setStatus] = useState<PropertyStatus>(initial?.status ?? "available");
  const [city, setCity] = useState(initial?.city ?? defaultCity);
  const [locality, setLocality] = useState(initial?.locality ?? "");
  const [plotNo, setPlotNo] = useState(initial?.plot_no ?? "");
  const [size, setSize] = useState(initial?.size_value ? String(Number(initial.size_value)) : "");
  const [unit, setUnit] = useState<SizeUnit>(initial?.size_unit ?? "gaj");
  const [priceText, setPriceText] = useState(initial?.price ? String(initial.price) : "");
  const [negotiable, setNegotiable] = useState(initial?.price_negotiable ?? true);
  const [received, setReceived] = useState(initial?.received_date ?? todayISO());
  const [facing, setFacing] = useState(initial?.facing ?? "");
  const [road, setRoad] = useState(initial?.road_width_ft ? String(initial.road_width_ft) : "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [more, setMore] = useState(editing);

  const [dups, setDups] = useState<DuplicateMatch[]>([]);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const price = parseAmount(priceText);
  const sizeNum = size ? Number(size) : null;

  function validate(): string {
    if (!source) return `${t("sourceContact")}: ${t("required")}`;
    if (!locality.trim()) return `${t("locality")}: ${t("required")}`;
    if (priceText.trim() && !price) return `${t("price")}: ${t("priceHint")}`;
    if (size && !(sizeNum && sizeNum > 0)) return `${t("size")}?`;
    return "";
  }

  async function submit(skipDupCheck = false) {
    const v = validate();
    if (v) { setErr(v); return; }
    setErr("");
    setBusy(true);
    try {
      if (!skipDupCheck) {
        const { data } = await sb.rpc("find_property_duplicates", {
          p_city: city, p_locality: locality, p_plot_no: plotNo || null,
          p_size_value: sizeNum, p_size_unit: unit, p_price: price, p_exclude: initial?.id ?? null,
        });
        if (data?.length) { setDups(data as DuplicateMatch[]); return; }
      }
      const row = {
        listing_source: listingSource,
        source_contact_id: source!.id,
        owner_contact_id: listingSource === "direct_owner" ? source!.id : owner?.id ?? null,
        property_type: ptype,
        purpose,
        status,
        city: city.trim() || defaultCity,
        locality: locality.trim(),
        plot_no: plotNo.trim() || null,
        size_value: sizeNum,
        size_unit: unit,
        price,
        price_negotiable: negotiable,
        received_date: received || todayISO(),
        facing: facing.trim() || null,
        road_width_ft: road ? Number(road) : null,
        notes: notes.trim() || null,
      };
      const res = editing
        ? await sb.from("properties").update(row).eq("id", initial!.id).select("id").single()
        : await sb.from("properties").insert(row).select("id").single();
      if (res.error) { setErr(`${t("error")}: ${res.error.message}`); return; }
      router.push(`/properties/${res.data.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  /** "Same property": link this person as another source on the existing listing. */
  async function linkToExisting(m: DuplicateMatch) {
    setBusy(true);
    const { error } = await sb.from("property_sources").upsert({
      property_id: m.id,
      contact_id: source!.id,
      listing_source: listingSource,
      received_date: received || todayISO(),
      quoted_price: price,
    }, { onConflict: "property_id,contact_id", ignoreDuplicates: true });
    setBusy(false);
    if (error) { setErr(`${t("error")}: ${error.message}`); return; }
    router.push(`/properties/${m.id}`);
    router.refresh();
  }

  const chip = (on: boolean) => `chip ${on ? "on" : ""}`;

  return (
    <div className="card">
      <div className="field">
        <label className="f">{t("source")}</label>
        <div className="grid2">
          {(["direct_owner", "broker"] as const).map((s) => (
            <button type="button" key={s} className={`btn lg ${listingSource === s ? "primary" : ""}`}
              onClick={() => setListingSource(s)}>
              {s === "direct_owner" ? "🏠 " : "🤝 "}{t(`source_${s}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="f">{t("sourceContact")}</label>
        <ContactPicker label={t("sourceContact")} value={source} onChange={setSource} defaultCity={defaultCity}
          defaultRoles={[listingSource === "broker" ? "broker" : "owner"]}
          preferRole={listingSource === "broker" ? "broker" : "owner"} />
      </div>

      {listingSource === "broker" && (
        <div className="field">
          <label className="f">{t("ownerContact")} <span className="opt">({t("optional")})</span></label>
          {owner === null && <div className="hint" style={{ marginTop: 0, marginBottom: 6 }}>{t("ownerUnknown")}</div>}
          <ContactPicker label={t("ownerContact")} value={owner} onChange={setOwner} defaultCity={defaultCity}
            defaultRoles={["owner"]} preferRole="owner" />
        </div>
      )}

      <div className="field">
        <label className="f">{t("type")}</label>
        <div className="chips wrapchips">
          {PROPERTY_TYPES.map((p) => (
            <button type="button" key={p} className={chip(ptype === p)} onClick={() => setPtype(p)}>{t(`type_${p}` as TKey)}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="f">{t("purpose")}</label>
        <div className="chips">
          {(["sale", "rent"] as const).map((p) => (
            <button type="button" key={p} className={chip(purpose === p)} onClick={() => setPurpose(p)}>{t(`purpose_${p}`)}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="f" htmlFor="p-loc">{t("locality")}</label>
        <input id="p-loc" className="input" list="localities" value={locality} autoComplete="off"
          placeholder="Sector 14" onChange={(e) => setLocality(e.target.value)} />
        <datalist id="localities">{localities.map((l) => <option key={l} value={l} />)}</datalist>
      </div>

      <div className="grid2">
        <div className="field">
          <label className="f" htmlFor="p-plot">{t("plotNo")} <span className="opt">🔒</span></label>
          <input id="p-plot" className="input" value={plotNo} onChange={(e) => setPlotNo(e.target.value)} autoComplete="off" />
        </div>
        <div className="field">
          <label className="f" htmlFor="p-city">{t("city")}</label>
          <input id="p-city" className="input" value={city} onChange={(e) => setCity(e.target.value)} />
        </div>
      </div>

      <div className="field">
        <label className="f" htmlFor="p-size">{t("size")}</label>
        <input id="p-size" className="input" type="number" inputMode="decimal" min="0" step="any" value={size}
          onChange={(e) => setSize(e.target.value)} style={{ marginBottom: 8 }} />
        <div className="chips wrapchips">
          {UNITS.map((u) => (
            <button type="button" key={u} className={chip(unit === u)} onClick={() => setUnit(u)}>{t(`unit_${u}` as TKey)}</button>
          ))}
        </div>
      </div>

      <div className="field">
        <label className="f" htmlFor="p-price">{purpose === "rent" ? t("pricePerMonth") : t("price")}</label>
        <input id="p-price" className={`input ${priceText && !price ? "err" : ""}`} inputMode="text" value={priceText}
          placeholder={t("priceHint")} onChange={(e) => setPriceText(e.target.value)} autoComplete="off" />
        {price ? <div className="hint" style={{ fontWeight: 700, color: "var(--text)" }}>= {formatPrice(price, lang)}</div>
               : <div className="hint">{t("priceHint")}</div>}
      </div>

      <div className="field">
        <label className="f" htmlFor="p-recv">{t("receivedDate")}</label>
        <input id="p-recv" className="input" type="date" value={received} max={todayISO()} onChange={(e) => setReceived(e.target.value)} />
      </div>

      {!more && <button type="button" className="btn block" style={{ marginBottom: 14 }} onClick={() => setMore(true)}>＋ {t("details")}</button>}
      {more && (
        <>
          {editing && (
            <div className="field">
              <label className="f">{t("status")}</label>
              <div className="chips wrapchips">
                {STATUSES.map((s) => (
                  <button type="button" key={s} className={chip(status === s)} onClick={() => setStatus(s)}>{t(`status_${s}` as TKey)}</button>
                ))}
              </div>
            </div>
          )}
          <label className="toggle field">
            <input type="checkbox" checked={negotiable} onChange={(e) => setNegotiable(e.target.checked)} /> {t("negotiable")}
          </label>
          <div className="grid2">
            <div className="field">
              <label className="f" htmlFor="p-facing">{t("facing")}</label>
              <select id="p-facing" className="input" value={facing} onChange={(e) => setFacing(e.target.value)}>
                <option value="">—</option>
                {["East", "West", "North", "South", "North-East", "North-West", "South-East", "South-West", "Corner"].map((f) => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label className="f" htmlFor="p-road">{t("roadWidth")}</label>
              <input id="p-road" className="input" type="number" inputMode="numeric" min="0" value={road} onChange={(e) => setRoad(e.target.value)} />
            </div>
          </div>
          <div className="field">
            <label className="f" htmlFor="p-notes">🔒 {t("notes")}</label>
            <textarea id="p-notes" className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
            <div className="hint">{t("notesHint")}</div>
          </div>
        </>
      )}

      {err && <div className="alert bad">{err}</div>}
      <button type="button" className="btn primary block lg" disabled={busy} onClick={() => submit(false)}>
        {busy ? t("saving") : t("save")}
      </button>

      {dups.length > 0 && (
        <Sheet title={`⚠️ ${t("possibleDuplicate")}`} onClose={() => setDups([])}>
          <div className="stack">
            {dups.map((m) => (
              <div key={m.id} className="card" style={{ margin: 0 }}>
                <div className="badge warn" style={{ marginBottom: 6 }}>
                  {m.match_reason === "same_plot" ? t("dupSamePlot") : t("dupSameSizePrice")}
                </div>
                <div style={{ fontWeight: 700 }}>
                  {t(`type_${m.property_type}` as TKey)} · {m.size_value ? `${Number(m.size_value)} ${t(`unit_${m.size_unit}` as TKey)} · ` : ""}{m.locality}
                </div>
                <div className="muted">
                  {m.plot_no ? `#${m.plot_no} · ` : ""}{formatPrice(m.price, lang)} · {formatDate(m.received_date)}
                </div>
                <div className="muted small">{t("sourceContact")}: {m.source_names.join(", ")}</div>
                <button type="button" className="btn primary block" style={{ marginTop: 10 }} disabled={busy}
                  onClick={() => linkToExisting(m)}>
                  ✓ {t("sameProperty")}
                </button>
                <div className="hint">{t("sameExplained")}</div>
              </div>
            ))}
            <button type="button" className="btn block lg" disabled={busy} onClick={() => { setDups([]); submit(true); }}>
              ✗ {t("differentProperty")}
            </button>
          </div>
        </Sheet>
      )}
    </div>
  );
}
