"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, []);
  if (typeof document === "undefined") return null;
  // Portal: keeps the sheet out of any surrounding <a>/<form> in the DOM.
  return createPortal(
    <div className="sheet-bg" onClick={(e) => { e.stopPropagation(); onClose(); }}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="hstack" style={{ justifyContent: "space-between", marginBottom: 10 }}>
          <h2 style={{ margin: 0 }}>{title}</h2>
          <button type="button" className="btn sm" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
