import { TopBar } from "@/components/TopBar";
import { PropertyForm } from "@/components/PropertyForm";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getLocalities } from "@/lib/localities";
import type { ContactLite } from "@/lib/types";

export default async function NewProperty({ searchParams }: { searchParams: Promise<{ source?: string }> }) {
  const { source } = await searchParams;
  const { t } = await getT();
  const sb = await createClient();
  const [settings, localities, src] = await Promise.all([
    getSettings(sb),
    getLocalities(sb),
    source ? sb.from("contacts").select("id, name, phone, area, roles").eq("id", source).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  return (
    <>
      <TopBar title={t("addProperty")} back="/properties" />
      <main className="wrap">
        <PropertyForm defaultCity={settings.default_city} localities={localities} initialSource={(src.data as ContactLite) ?? null} />
      </main>
    </>
  );
}
