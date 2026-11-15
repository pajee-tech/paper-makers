"use client";
import Link from "next/link";
import { useState } from "react";
import PublicHeader from "@/components/PublicHeader";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ emailEnabled: boolean; supportWhatsapp?: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const r = await fetch("/api/password/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
    setDone(await r.json().catch(() => ({ emailEnabled: false })));
    setBusy(false);
  }

  return (
    <>
      <PublicHeader />
      <main className="container" style={{ maxWidth: 440, paddingTop: 50 }}>
        <form className="card" onSubmit={submit}>
          <h1>Forgot password</h1>
          {!done ? (
            <>
              <p className="muted small">Enter the email you registered with. We&apos;ll send you a link to set a new password.</p>
              <div className="field"><label>Email</label><input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
              <button disabled={busy} style={{ width: "100%", justifyContent: "center" }}>{busy ? "Sending…" : "Send reset link"}</button>
            </>
          ) : done.emailEnabled ? (
            <div className="alert ok">If an account exists for <b>{email}</b>, a reset link has been sent. Check your inbox and spam folder. The link works for 60 minutes.</div>
          ) : (
            <div className="alert">
              Password reset by email isn&apos;t switched on yet. Please contact support
              {done.supportWhatsapp ? (
                <> on <a href={`https://wa.me/${done.supportWhatsapp}?text=${encodeURIComponent(`Assalam-o-Alaikum, please send me a password reset link for ${email}`)}`} target="_blank" rel="noreferrer">WhatsApp</a></>
              ) : null}{" "}
              and they will send you a reset link. Teachers can also ask their school admin to set a new password.
            </div>
          )}
          <p className="small muted" style={{ marginTop: 12 }}><Link href="/login">← Back to sign in</Link></p>
        </form>
      </main>
    </>
  );
}
