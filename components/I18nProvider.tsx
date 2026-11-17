"use client";
import { createContext, useContext, useMemo } from "react";
import { translator, type Lang, type TKey } from "@/lib/i18n";

const Ctx = createContext<{ lang: Lang; t: (k: TKey) => string }>({ lang: "hi", t: translator("hi") });

export function I18nProvider({ lang, children }: { lang: Lang; children: React.ReactNode }) {
  const value = useMemo(() => ({ lang, t: translator(lang) }), [lang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);
