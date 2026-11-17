"use client";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "./I18nProvider";

export function WriteOffToggle({ id, writtenOff }: { id: string; writtenOff: boolean }) {
  const { t } = useT();
  const router = useRouter();
  return (
    <button type="button" className={`btn block ${writtenOff ? "" : "danger"}`} onClick={async () => {
      if (!writtenOff && !confirm(`${t("writeOff")}?`)) return;
      // 'expected' makes the database re-derive the real status from payments
      await supabaseBrowser().from("commissions").update({ status: writtenOff ? "expected" : "written_off" }).eq("id", id);
      router.refresh();
    }}>
      {writtenOff ? t("undoWriteOff") : t("writeOff")}
    </button>
  );
}

export function DeletePayment({ id }: { id: string }) {
  const { t } = useT();
  const router = useRouter();
  return (
    <button type="button" className="btn sm danger" aria-label={t("delete")} onClick={async () => {
      if (!confirm(`${t("delete")}?`)) return;
      const { error, count } = await supabaseBrowser().from("commission_payments").delete({ count: "exact" }).eq("id", id);
      if (error || count === 0) alert(t("error"));
      router.refresh();
    }}>✕</button>
  );
}
