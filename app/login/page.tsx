"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr("");
    const r = await signIn("credentials", { email, password, redirect: false });
    setBusy(false);
    if (r?.error) setErr("Wrong email or password");
    else window.location.href = new URLSearchParams(window.location.search).get("callbackUrl") ?? "/dashboard";
  }

  return (
    <main className="container" style={{ maxWidth: 420, paddingTop: 70 }}>
      <form className="card" onSubmit={submit}>
        <h1>Sign in</h1>
        {err && <div className="alert err">{err}</div>}
        <div className="field"><label>Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div className="field"><label>Password</label><input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <button disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Signing in…" : "Sign in"}</button>
        <p className="small muted" style={{ marginTop: 12 }}>New institution? <Link href="/register">Create a free account</Link></p>
      </form>
    </main>
  );
}
