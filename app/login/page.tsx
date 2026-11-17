"use client";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useT } from "@/components/I18nProvider";
import { LangToggle } from "@/components/LangToggle";

export default function LoginPage() {
  const { t } = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: email.trim(), password });
    if (error) {
      setErr(t("loginFailed"));
      setBusy(false);
      return;
    }
    window.location.href = "/";
  }

  return (
    <>
      <header className="top"><div className="in"><h1>{t("appName")}</h1><LangToggle /></div></header>
      <main className="wrap" style={{ paddingTop: 32 }}>
        <form onSubmit={submit} className="card">
          <div className="field">
            <label className="f" htmlFor="email">{t("email")}</label>
            <input id="email" className="input" type="email" autoComplete="username" inputMode="email"
              value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label className="f" htmlFor="password">{t("password")}</label>
            <input id="password" className="input" type="password" autoComplete="current-password"
              value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {err && <div className="alert bad">{err}</div>}
          <button className="btn primary block lg" disabled={busy}>{busy ? "…" : t("login")}</button>
        </form>
      </main>
    </>
  );
}
