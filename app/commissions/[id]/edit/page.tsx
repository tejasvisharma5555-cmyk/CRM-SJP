import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { CommissionForm, type CommissionInitial } from "@/components/CommissionForm";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import type { ContactLite } from "@/lib/types";

const C = "id, name, phone, area, roles";

export default async function EditCommission({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const sb = await createClient();
  const { data } = await sb.from("commissions")
    .select(`*, shared_with:contacts!commissions_shared_with_contact_id_fkey(${C}), buyer:contacts!commissions_buyer_contact_id_fkey(${C}), property:properties(price)`)
    .eq("id", id).maybeSingle();
  if (!data) notFound();
  const settings = await getSettings(sb);
  const d = data as CommissionInitial & { shared_with: ContactLite | null; buyer: ContactLite | null; property: { price: number | null } };
  return (
    <>
      <TopBar title={t("edit")} back={`/commissions/${id}`} />
      <main className="wrap">
        <CommissionForm initial={d} defaultCity={settings.default_city} propertyPrice={d.property?.price ?? null} />
      </main>
    </>
  );
}
