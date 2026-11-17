"use client";
import { useRouter } from "next/navigation";
import { useT } from "./I18nProvider";
import { LANG_COOKIE } from "@/lib/i18n";

export function LangToggle() {
  const { lang } = useT();
  const router = useRouter();
  const next = lang === "hi" ? "en" : "hi";
  return (
    <button
      className="langbtn"
      aria-label="Change language / भाषा बदलें"
      onClick={() => {
        document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
        router.refresh();
      }}
    >
      {lang === "hi" ? "English" : "हिंदी"}
    </button>
  );
}
