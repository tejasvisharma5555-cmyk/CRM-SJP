"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Debounced search that updates ?q= without a full page load. */
export function SearchBox({ placeholder, param = "q" }: { placeholder: string; param?: string }) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  const [v, setV] = useState(sp.get(param) ?? "");
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    const id = setTimeout(() => {
      const next = new URLSearchParams(sp.toString());
      if (v.trim()) next.set(param, v.trim()); else next.delete(param);
      next.delete("n");
      router.replace(`${path}?${next.toString()}`, { scroll: false });
    }, 350);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [v]);

  return (
    <div className="searchbar">
      <input className="input" type="search" value={v} placeholder={placeholder}
        onChange={(e) => setV(e.target.value)} enterKeyHint="search" />
    </div>
  );
}
