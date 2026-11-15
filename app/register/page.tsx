"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function RegisterPage() {
  const [f, setF] = useState({ institutionName: "", institutionType: "SCHOOL", city: "", name: "", email: "", password: "" });
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value });

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
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
    <main className="container" style={{ maxWidth: 520, paddingTop: 50 }}>
      <form className="card" onSubmit={submit}>
        <h1>Create your institution</h1>
        <p className="muted small">Free trial: 3 papers, every feature. No card needed.</p>
        {err && <div className="alert err">{err}</div>}
        <div className="field"><label>Institution name</label><input required value={f.institutionName} onChange={set("institutionName")} placeholder="e.g. The Smart School, Rawalpindi" /></div>
        <div className="grid2">
          <div className="field">
            <label>Type</label>
            <select value={f.institutionType} onChange={set("institutionType")}>
              <option value="SCHOOL">School (Nursery–Matric)</option>
              <option value="COLLEGE">College (Matric–Graduation)</option>
              <option value="ACADEMY">Academy / Tuition centre</option>
              <option value="DEGREE_INSTITUTE">Degree institute</option>
            </select>
          </div>
          <div className="field"><label>City</label><input value={f.city} onChange={set("city")} /></div>
        </div>
        <div className="field"><label>Your name</label><input required value={f.name} onChange={set("name")} /></div>
        <div className="field"><label>Email</label><input type="email" required value={f.email} onChange={set("email")} /></div>
        <div className="field"><label>Password (min 8 characters)</label><input type="password" minLength={8} required value={f.password} onChange={set("password")} /></div>
        <button disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Creating…" : "Create free account"}</button>
        <p className="small muted" style={{ marginTop: 12 }}>Already registered? <Link href="/login">Sign in</Link></p>
      </form>
    </main>
  );
}
