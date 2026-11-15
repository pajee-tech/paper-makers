"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";
import PublicHeader from "@/components/PublicHeader";

export default function RegisterPage() {
  const [f, setF] = useState({ institutionName: "", institutionType: "SCHOOL", city: "", name: "", email: "", password: "" });
  const [confirm, setConfirm] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (f.password !== confirm) return setErr("Both passwords must match.");
    setBusy(true);
    const r = await fetch("/api/register", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setBusy(false);
      setErr(d.issues?.join(", ") ?? d.error ?? "Could not register");
      return;
    }
    await signIn("credentials", { email: f.email, password: f.password, redirect: false });
    window.location.href = "/dashboard";
  }

  return (
    <>
      <PublicHeader />
      <main className="container" style={{ maxWidth: 540, paddingTop: 40 }}>
        <form className="card" onSubmit={submit}>
          <h1>Create your free account</h1>
          <p className="muted small">Every class from Playgroup to BS (Hons) with its subjects is set up for you automatically. No card needed.</p>
          {err && <div className="alert err">{err}</div>}
          <div className="field"><label>School / college / academy name</label><input required value={f.institutionName} onChange={set("institutionName")} placeholder="e.g. The Smart School, Rawalpindi" /></div>
          <div className="grid2">
            <div className="field">
              <label>Type</label>
              <select value={f.institutionType} onChange={set("institutionType")}>
                <option value="SCHOOL">School</option>
                <option value="COLLEGE">College</option>
                <option value="ACADEMY">Academy / Tuition centre</option>
                <option value="DEGREE_INSTITUTE">Degree institute / University</option>
              </select>
            </div>
            <div className="field"><label>City</label><input value={f.city} onChange={set("city")} /></div>
          </div>
          <div className="field"><label>Your name</label><input required autoComplete="name" value={f.name} onChange={set("name")} /></div>
          <div className="field"><label>Email</label><input type="email" autoComplete="email" required value={f.email} onChange={set("email")} /></div>
          <div className="grid2">
            <div className="field"><label>Password (min 8)</label><PasswordInput value={f.password} onChange={(v) => setF({ ...f, password: v })} minLength={8} autoComplete="new-password" /></div>
            <div className="field"><label>Confirm password</label><PasswordInput value={confirm} onChange={setConfirm} minLength={8} autoComplete="new-password" /></div>
          </div>
          <button disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Creating your account…" : "Create free account"}</button>
          <p className="small muted" style={{ marginTop: 12 }}>Already registered? <Link href="/login">Sign in</Link> · <Link href="/forgot-password">Forgot password?</Link></p>
          <p className="small muted">By creating an account you accept the <Link href="/terms">Terms</Link>.</p>
        </form>
      </main>
    </>
  );
}
