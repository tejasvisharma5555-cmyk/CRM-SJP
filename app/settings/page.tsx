import { TopBar } from "@/components/TopBar";
import { SettingsForm } from "@/components/SettingsForm";
import { LogoutButton } from "@/components/LogoutButton";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { getSettings } from "@/lib/settings";

export default async function SettingsPage() {
  const { t } = await getT();
  const sb = await createClient();
  const [settings, { data: admin }, { data: { user } }] = await Promise.all([
    getSettings(sb), sb.rpc("is_team_admin"), sb.auth.getUser(),
  ]);
  return (
    <>
      <TopBar title={t("settings")} back="/" />
      <main className="wrap">
        <SettingsForm initial={settings} canEdit={admin === true} />
        <p className="muted small">{user?.email}</p>
        <LogoutButton />
      </main>
    </>
  );
}
