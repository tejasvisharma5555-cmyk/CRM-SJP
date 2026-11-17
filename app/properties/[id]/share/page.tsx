import { TopBar } from "@/components/TopBar";
import { ShareComposer } from "@/components/ShareComposer";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import type { PublicPropertyCard } from "@/lib/types";

// PRIVACY: this page reads ONLY the public_property_card view. Do not add
// queries to properties / contacts / commissions here.
const CARD_COLUMNS =
  "id, property_type, purpose, city, locality, plot_no, size_value, size_unit, price, price_negotiable, status, photo_paths, business_name, public_phone";

export default async function SharePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { t } = await getT();
  const sb = await createClient();
  const { data } = await sb.from("public_property_card").select(CARD_COLUMNS).eq("id", id).maybeSingle();
  const card = data as PublicPropertyCard | null;

  let photoUrls: string[] = [];
  if (card?.photo_paths.length) {
    const { data: signed } = await sb.storage.from("property-photos").createSignedUrls(card.photo_paths, 3600);
    photoUrls = (signed ?? []).map((s) => s.signedUrl).filter(Boolean) as string[];
  }

  return (
    <>
      <TopBar title={t("shareTitle")} back={`/properties/${id}`} />
      <main className="wrap">
        {card ? <ShareComposer card={card} photoUrls={photoUrls} /> : <div className="alert warn">{t("notShareable")}</div>}
      </main>
    </>
  );
}
