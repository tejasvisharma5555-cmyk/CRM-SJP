import type { Metadata, Viewport } from "next";
import "./globals.css";
import { I18nProvider } from "@/components/I18nProvider";
import { BottomNav } from "@/components/BottomNav";
import { LogoutButton } from "@/components/LogoutButton";
import { getLang } from "@/lib/server-i18n";
import { translator } from "@/lib/i18n";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "SJP Property",
  description: "Property listings, contacts and commission",
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const lang = await getLang();
  const t = translator(lang);
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  let allowed = true;
  if (user) {
    const { data } = await supabase.rpc("is_team_member");
    allowed = data === true;
  }

  return (
    <html lang={lang}>
      <body>
        <I18nProvider lang={lang}>
          {user && !allowed ? (
            <main className="wrap" style={{ paddingTop: 48 }}>
              <div className="alert bad">{t("notMember")}</div>
              <p className="muted">{user.email}</p>
              <LogoutButton />
            </main>
          ) : (
            <>
              {children}
              <BottomNav />
            </>
          )}
        </I18nProvider>
      </body>
    </html>
  );
}
