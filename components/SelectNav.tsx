"use client";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

/** A native <select> that updates one URL param — cheap on low-end phones. */
export function SelectNav({ param, options, value, label }: {
  param: string; value: string; label: string; options: { value: string; label: string }[];
}) {
  const router = useRouter();
  const path = usePathname();
  const sp = useSearchParams();
  return (
    <select aria-label={label} className="input" value={value} onChange={(e) => {
      const next = new URLSearchParams(sp.toString());
      if (e.target.value) next.set(param, e.target.value); else next.delete(param);
      next.delete("n");
      router.replace(`${path}?${next.toString()}`, { scroll: false });
    }}>
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
