"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useT } from "./I18nProvider";

export function BottomNav() {
  const path = usePathname();
  const { t } = useT();
  if (path.startsWith("/login")) return null;
  const items = [
    { href: "/", ic: "🏠", label: t("home"), on: path === "/" },
    { href: "/properties", ic: "🏘️", label: t("properties"), on: path.startsWith("/properties") },
    { href: "/contacts", ic: "👥", label: t("contacts"), on: path.startsWith("/contacts") },
    { href: "/commissions", ic: "₹", label: t("commission"), on: path.startsWith("/commissions") },
  ];
  return (
    <nav className="nav">
      <div className="in">
        {items.map((i) => (
          <Link key={i.href} href={i.href} className={i.on ? "on" : ""}>
            <span className="ic">{i.ic}</span>
            {i.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
