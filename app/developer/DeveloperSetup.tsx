"use client";
import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";

export default function DeveloperSetup() {
  const [f, setF] = useState({ setupKey: "", email: "", password: "", name: "", institutionName: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await fetch("/api/developer/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...f, name: f.name || undefined, institutionName: f.institutionName || undefined }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    setMsg(r.ok
      ? { ok: true, text: d.created ? "Super Admin account created ✔ Sign in to open /admin." : "Existing account upgraded to Super Admin ✔ Sign out and sign in again." }
      : { ok: false, text: d.issues?.join(", ") ?? d.error ?? "Setup failed" });
  }

  return (
    <form className="card" onSubmit={submit}>
      <h1>Super Admin setup</h1>
      <p className="small muted">Needs the secret <code>SUPER_ADMIN_SETUP_KEY</code> and the email set in <code>SUPER_ADMIN_EMAIL</code>. If the email is already registered, enter that account&apos;s password to upgrade it.</p>
      {msg && <div className={`alert ${msg.ok ? "ok" : "err"}`}>{msg.text} {msg.ok && <a href="/login">Sign in →</a>}</div>}
      <div className="field"><label>Developer setup key</label><PasswordInput value={f.setupKey} onChange={(v) => setF({ ...f, setupKey: v })} autoComplete="off" /></div>
      <div className="field"><label>Super Admin email</label><input type="email" required value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></div>
      <div className="field"><label>Password (min 8)</label><PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} minLength={8} autoComplete="new-password" /></div>
      <div className="grid2">
        <div className="field"><label>Your name (new account)</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="Super Admin" /></div>
        <div className="field"><label>Organisation (new account)</label><input value={f.institutionName} onChange={(e) => setF({ ...f, institutionName: e.target.value })} placeholder="Pajee Technologies" /></div>
      </div>
      <button disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Checking…" : "Create / upgrade Super Admin"}</button>
    </form>
  );
}
