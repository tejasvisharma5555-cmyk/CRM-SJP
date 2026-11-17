import type { TKey } from "@/lib/i18n";
import type { ContactRole } from "@/lib/types";

export function RoleBadges({ roles, t }: { roles: ContactRole[]; t: (k: TKey) => string }) {
  return (
    <>
      {roles.map((r) => (
        <span key={r} className={`badge ${r === "broker" ? "warn" : r === "buyer" ? "grey" : ""}`}>
          {t(`role_${r}` as TKey)}
        </span>
      ))}
    </>
  );
}
