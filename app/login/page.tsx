"use client";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useState } from "react";
import PasswordInput from "@/components/PasswordInput";
import PublicHeader from "@/components/PublicHeader";

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
    <>
      <PublicHeader />
      <main className="container" style={{ maxWidth: 440, paddingTop: 50 }}>
        <form className="card" onSubmit={submit}>
          <h1>Sign in</h1>
          {err && <div className="alert err">{err}</div>}
          <div className="field"><label>Email</label><input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="field">
            <div className="row" style={{ justifyContent: "space-between" }}>
              <label style={{ margin: 0 }}>Password</label>
              <Link className="small" href="/forgot-password">Forgot password?</Link>
            </div>
            <div style={{ marginTop: 4 }}><PasswordInput value={password} onChange={setPassword} /></div>
          </div>
          <button disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Signing in…" : "Sign in"}</button>
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 14, textAlign: "center" }}>
            <div className="small muted" style={{ marginBottom: 8 }}>New school, college or academy?</div>
            <Link className="btn btn-ghost" href="/register" style={{ width: "100%", justifyContent: "center" }}>Create a free account</Link>
          </div>
        </form>
      </main>
    </>
  );
}
