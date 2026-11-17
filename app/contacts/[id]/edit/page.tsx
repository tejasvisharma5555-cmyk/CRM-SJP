import { notFound } from "next/navigation";
import { TopBar } from "@/components/TopBar";
import { ContactFormPage } from "@/components/ContactFormPage";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import type { Contact } from "@/lib/types";

export default async function EditContact({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const sb = await createClient();
  const { data } = await sb.from("contacts").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  return (
    <>
      <TopBar title={t("edit")} back={`/contacts/${id}`} />
      <main className="wrap"><ContactFormPage initial={data as Contact} defaultCity="" /></main>
    </>
  );
}
