import Link from "next/link";
import { TopBar } from "@/components/TopBar";
import { SearchBox } from "@/components/SearchBox";
import { RoleBadges } from "@/components/RoleBadges";
import { getT } from "@/lib/server-i18n";
import { createClient } from "@/lib/supabase/server";
import { contactSearchFilter, withParams } from "@/lib/search";
import { displayPhone, telLink } from "@/lib/phone";
import { ROLES, type Contact } from "@/lib/types";
import type { TKey } from "@/lib/i18n";

type SP = { q?: string; role?: string; sort?: string; n?: string };

export default async function ContactsPage({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = await searchParams;
  const { t } = await getT();
  const supabase = await createClient();
  const limit = Math.min(Number(sp.n) || 30, 300);
  const sort = sp.sort ?? "listings";

  let q = supabase.from("contacts").select("id, name, phone, area, roles, listings_count", { count: "exact" });
  const f = contactSearchFilter(sp.q ?? "");
  if (f) q = q.or(f);
  if (sp.role && (ROLES as string[]).includes(sp.role)) q = q.contains("roles", [sp.role]);
  if (sort === "listings") q = q.order("listings_count", { ascending: false }).order("name");
  else if (sort === "name") q = q.order("name");
  else q = q.order("created_at", { ascending: false });
  const { data, count } = await q.limit(limit);
  const rows = (data ?? []) as Pick<Contact, "id" | "name" | "phone" | "area" | "roles" | "listings_count">[];

  const cur = { q: sp.q, role: sp.role, sort: sp.sort };
  return (
    <>
      <TopBar title={t("contacts")} />
      <main className="wrap">
        <SearchBox placeholder={t("searchNamePhone")} />
        <div className="chips" style={{ marginBottom: 8 }}>
          <Link className={`chip ${!sp.role ? "on" : ""}`} href={withParams("/contacts", cur, { role: undefined })}>{t("all")}</Link>
          {ROLES.map((r) => (
            <Link key={r} className={`chip ${sp.role === r ? "on" : ""}`} href={withParams("/contacts", cur, { role: r })}>
              {t(`role_${r}` as TKey)}
            </Link>
          ))}
        </div>
        <div className="chips" style={{ marginBottom: 12 }}>
          {([["listings", "sortListings"], ["recent", "sortRecent"], ["name", "sortName"]] as const).map(([k, label]) => (
            <Link key={k} className={`chip ${sort === k ? "on" : ""}`} href={withParams("/contacts", cur, { sort: k })}>
              {t(label)}
            </Link>
          ))}
        </div>

        <div className="list">
          {rows.map((c) => (
            <div key={c.id} className="row">
              <Link href={`/contacts/${c.id}`} className="grow">
                <div className="t1">{c.name}</div>
                <div className="t2"><RoleBadges roles={c.roles} t={t} />{c.area ? ` ${c.area}` : ""}</div>
                <div className="t2">{displayPhone(c.phone)} · {c.listings_count} {t("listings")}</div>
              </Link>
              <a href={telLink(c.phone)} className="btn call sm" aria-label={t("call")}>📞</a>
            </div>
          ))}
          {!rows.length && <div className="empty">{t("none")}</div>}
          {count != null && count > rows.length && (
            <Link className="btn block" href={withParams("/contacts", cur, { n: String(limit + 30) })} scroll={false}>
              {t("more")} ({count - rows.length})
            </Link>
          )}
        </div>
        <Link href="/contacts/new" className="btn primary fab">＋ {t("addContact")}</Link>
      </main>
    </>
  );
}
