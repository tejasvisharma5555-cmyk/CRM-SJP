import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { PropertyForm } from "@/components/PropertyForm";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";
import { getLocalities } from "@/lib/localities";
import type { ContactLite, Property } from "@/lib/types";

const C = "id, name, phone, area, roles";

export default async function EditProperty({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const sb = await createClient();
  const { data } = await sb.from("properties")
    .select(`*, source:contacts!properties_source_contact_id_fkey(${C}), owner:contacts!properties_owner_contact_id_fkey(${C})`)
    .eq("id", id).maybeSingle();
  if (!data) notFound();
  const [settings, localities] = await Promise.all([getSettings(sb), getLocalities(sb)]);
  const { source, owner, ...p } = data as Property & { source: ContactLite; owner: ContactLite | null };
  return (
    <>
      <TopBar title={t("edit")} back={`/properties/${id}`} />
      <main className="wrap">
        <PropertyForm initial={p} initialSource={source} initialOwner={owner} defaultCity={settings.default_city} localities={localities} />
      </main>
    </>
  );
}
