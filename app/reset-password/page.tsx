"use client";
import Link from "next/link";
import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import PasswordInput from "@/components/PasswordInput";
import PublicHeader from "@/components/PublicHeader";

function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (pw !== pw2) return setMsg({ ok: false, text: "Both passwords must match." });
    setBusy(true);
    const r = await fetch("/api/password/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token, password: pw }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Password changed ✔ You can sign in now." } : { ok: false, text: d.error ?? "Could not reset password" });
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>Set a new password</h1>
      {!token && <div className="alert err">This link is missing its token. Open the link from your email or WhatsApp again.</div>}
      {msg && <div className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text}</div>}
      {!msg?.ok ? (
        <>
          <div className="field"><label>New password (min 8 characters)</label><PasswordInput value={pw} onChange={setPw} minLength={8} autoComplete="new-password" /></div>
          <div className="field"><label>Confirm new password</label><PasswordInput value={pw2} onChange={setPw2} minLength={8} autoComplete="new-password" /></div>
          <button disabled={busy || !token} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Saving…" : "Save new password"}</button>
        </>
      ) : (
        <Link className="btn" href="/login">Go to sign in</Link>
      )}
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <>
      <PublicHeader />
      <main className="container" style={{ maxWidth: 440, paddingTop: 50 }}>
        <Suspense fallback={<p className="muted">Loading…</p>}>
          <ResetForm />
        </Suspense>
      </main>
    </>
  );
}
