import Link from "next/link";
import { LangToggle } from "./LangToggle";

export function TopBar({ title, back }: { title: string; back?: string }) {
  return (
    <header className="top">
      <div className="in">
        {back && <Link href={back} className="back" aria-label="Back">‹</Link>}
        <h1>{title}</h1>
        <LangToggle />
      </div>
    </header>
  );
}
