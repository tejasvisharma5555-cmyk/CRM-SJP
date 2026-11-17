"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "./I18nProvider";

/** Re-encode to max 1280px JPEG: ~150-300 KB instead of 4 MB, and strips EXIF/GPS. */
async function shrink(file: File): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bmp.width * scale);
  canvas.height = Math.round(bmp.height * scale);
  canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
  bmp.close();
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.8));
}

export function PhotoManager({ propertyId, photos }: { propertyId: string; photos: { id: string; path: string; url: string }[] }) {
  const { t } = useT();
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setErr("");
    const sb = supabaseBrowser();
    try {
      let order = photos.length;
      for (const f of Array.from(files)) {
        const blob = await shrink(f);
        const path = `${propertyId}/${crypto.randomUUID()}.jpg`;
        const up = await sb.storage.from("property-photos").upload(path, blob, { contentType: "image/jpeg" });
        if (up.error) throw up.error;
        const ins = await sb.from("property_photos").insert({ property_id: propertyId, storage_path: path, sort_order: order++ });
        if (ins.error) throw ins.error;
      }
      router.refresh();
    } catch (e) {
      setErr(`${t("error")}: ${(e as Error).message}`);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  async function remove(id: string, path: string) {
    if (!confirm(`${t("delete")}?`)) return;
    const sb = supabaseBrowser();
    await sb.from("property_photos").delete().eq("id", id);
    await sb.storage.from("property-photos").remove([path]);
    router.refresh();
  }

  return (
    <div>
      {photos.length > 0 && (
        <div className="photos" style={{ marginBottom: 10 }}>
          {photos.map((p) => (
            <div key={p.id} style={{ position: "relative" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" loading="lazy" decoding="async" />
              <button type="button" onClick={() => remove(p.id, p.path)} aria-label={t("delete")}
                style={{ position: "absolute", top: 4, right: 4, border: 0, borderRadius: 14, width: 28, height: 28, background: "rgba(0,0,0,.6)", color: "#fff" }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <input ref={input} type="file" accept="image/*" multiple hidden onChange={(e) => upload(e.target.files)} />
      <button type="button" className="btn block" disabled={busy} onClick={() => input.current?.click()}>
        📷 {busy ? t("uploading") : t("addPhotos")}
      </button>
      {err && <div className="errtext">{err}</div>}
    </div>
  );
}
