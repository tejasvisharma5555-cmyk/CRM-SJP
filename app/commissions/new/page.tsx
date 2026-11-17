import { notFound, redirect } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { CommissionForm } from "@/components/CommissionForm";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { loadPropertyBrief } from "@/lib/commission-loader";
import type { TKey } from "@/lib/i18n";

export default async function NewCommission({ searchParams }: { searchParams: Promise<{ property?: string }> }) {
  const { property } = await searchParams;
  if (!property) redirect("/properties");
  const { t } = await getT();
  const sb = await createClient();
  const existing = await sb.from("commissions").select("id").eq("property_id", property).maybeSingle();
  if (existing.data) redirect(`/commissions/${existing.data.id}`);
  const [p, settings] = await Promise.all([loadPropertyBrief(sb, property), getSettings(sb)]);
  if (!p) notFound();
  return (
    <>
      <TopBar title={t("addCommission")} back={`/properties/${property}`} />
      <main className="wrap">
        <div className="muted" style={{ marginBottom: 10 }}>
          {t(`type_${p.property_type}` as TKey)} · {p.locality}, {p.city}
        </div>
        <CommissionForm initial={{ property_id: property }} defaultCity={settings.default_city} propertyPrice={p.price} />
      </main>
    </>
  );
}
