"use client";
import { useEffect, useMemo, useState } from "react";
import { buildShareMessage } from "@/lib/share";
import { whatsappShareLink } from "@/lib/phone";
import type { PublicPropertyCard } from "@/lib/types";
import { useT } from "./I18nProvider";

export function ShareComposer({ card, photoUrls }: { card: PublicPropertyCard; photoUrls: string[] }) {
  const { t, lang } = useT();
  const [msgLang, setMsgLang] = useState(lang);
  const [withPlot, setWithPlot] = useState(false); // OFF by default
  const [canShareFiles, setCanShareFiles] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const text = useMemo(() => buildShareMessage(card, { lang: msgLang, includePlotNo: withPlot }), [card, msgLang, withPlot]);

  useEffect(() => {
    try {
      const probe = new File([new Blob(["x"], { type: "image/jpeg" })], "p.jpg", { type: "image/jpeg" });
      setCanShareFiles(photoUrls.length > 0 && !!navigator.canShare?.({ files: [probe] }));
    } catch { setCanShareFiles(false); }
  }, [photoUrls.length]);

  async function shareWithPhotos() {
    setBusy(true);
    try {
      const files = await Promise.all(photoUrls.slice(0, 10).map(async (u, i) => {
        const b = await (await fetch(u)).blob();
        return new File([b], `property-${i + 1}.jpg`, { type: "image/jpeg" });
      }));
      await navigator.share({ files, text });
    } catch {
      // user cancelled or share failed — nothing to do
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="alert ok" style={{ fontWeight: 500 }}>🔒 {t("shareSafe")}</div>

      <div className="chips" style={{ marginBottom: 10 }}>
        <button type="button" className={`chip ${msgLang === "hi" ? "on" : ""}`} onClick={() => setMsgLang("hi")}>हिंदी</button>
        <button type="button" className={`chip ${msgLang === "en" ? "on" : ""}`} onClick={() => setMsgLang("en")}>English</button>
      </div>
      {card.plot_no && (
        <label className="toggle">
          <input type="checkbox" checked={withPlot} onChange={(e) => setWithPlot(e.target.checked)} /> {t("includePlotNo")}
        </label>
      )}

      <h2>{t("sharePreview")}</h2>
      <div className="preview" data-testid="share-preview">{text}</div>

      {photoUrls.length > 0 && (
        <div className="photos" style={{ marginTop: 10 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {photoUrls.map((u) => <img key={u} src={u} alt="" loading="lazy" />)}
        </div>
      )}

      <div className="stack" style={{ marginTop: 14 }}>
        {canShareFiles && (
          <button type="button" className="btn wa block lg" disabled={busy} onClick={shareWithPhotos}>
            📷 {busy ? "…" : t("shareWithPhotos")}
          </button>
        )}
        <a className={`btn block lg ${canShareFiles ? "" : "wa"}`} href={whatsappShareLink(text)} target="_blank" rel="noopener noreferrer">
          💬 {t("sendWhatsapp")}
        </a>
        <button type="button" className="btn block" onClick={async () => {
          await navigator.clipboard?.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}>{copied ? `✓ ${t("copied")}` : t("copy")}</button>
      </div>
    </div>
  );
}
