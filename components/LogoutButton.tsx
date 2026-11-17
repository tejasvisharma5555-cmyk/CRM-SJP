"use client";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "./I18nProvider";

export function LogoutButton() {
  const { t } = useT();
  return (
    <button
      className="btn block"
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        window.location.href = "/login";
      }}
    >
      {t("logout")}
    </button>
  );
}
