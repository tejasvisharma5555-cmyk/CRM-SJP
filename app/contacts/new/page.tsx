import { TopBar } from "@/components/TopBar";
import { ContactFormPage } from "@/components/ContactFormPage";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";

export default async function NewContact() {
  const { t } = await getT();
  const s = await getSettings(await createClient());
  return (
    <>
      <TopBar title={t("addContact")} back="/contacts" />
      <main className="wrap"><ContactFormPage defaultCity={s.default_city} /></main>
    </>
  );
}
