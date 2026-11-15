"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/useCatalog";

interface Billing {
  plan: "FREE_TRIAL" | "PAPER_MAKER_PRO";
  proUntil: string | null;
  used: number;
  limit: number;
  remaining: number | null;
  payments: { id: string; method: string; transactionId: string; amount: number; months: number; status: string; createdAt: string; note?: string }[];
}

const PRICE = Number(process.env.NEXT_PUBLIC_PRO_PRICE_PKR ?? 1500);
const PERIOD = process.env.NEXT_PUBLIC_PRO_PERIOD ?? "month";
const METHODS = [
  { key: "JAZZCASH", label: "JazzCash", info: process.env.NEXT_PUBLIC_PAY_JAZZCASH },
  { key: "EASYPAISA", label: "EasyPaisa", info: process.env.NEXT_PUBLIC_PAY_EASYPAISA },
  { key: "BANK", label: "Bank transfer", info: process.env.NEXT_PUBLIC_PAY_BANK },
];

export default function BillingPage() {
  const [b, setB] = useState<Billing | null>(null);
  const [f, setF] = useState({ method: "JAZZCASH", transactionId: "", months: 1, payerName: "", payerPhone: "" });
  const [msg, setMsg] = useState("");
  const load = () => api<Billing>("/api/billing", "GET").then(setB);
  useEffect(() => { load(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/billing", "POST", { ...f, amount: PRICE * f.months });
      setMsg("Submitted ✔ — your account is upgraded as soon as the payment is verified (usually within a few hours).");
      setF({ ...f, transactionId: "" });
      load();
    } catch (err) { setMsg((err as Error).message); }
  }

  if (!b) return <p className="muted">Loading…</p>;
  const wa = process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP;

  return (
    <div>
      <h1>Billing</h1>
      <div className="card">
        {b.plan === "PAPER_MAKER_PRO" ? (
          <p><span className="badge ok">PAPER MAKER PRO</span> Active{b.proUntil ? ` until ${new Date(b.proUntil).toLocaleDateString("en-GB")}` : ""}. Unlimited papers, no watermark.</p>
        ) : (
          <p><span className="badge warn">FREE TRIAL</span> {b.used} of {b.limit} free papers used. Trial papers carry a light watermark.</p>
        )}
      </div>

      <div className="grid2">
        <div className="card" style={{ marginTop: 14 }}>
          <h2>Upgrade — Rs {PRICE.toLocaleString()} / {PERIOD}</h2>
          <p className="muted small">1. Send the amount to any account below. 2. Enter the Transaction ID (TID) from your SMS / receipt. 3. We verify and switch on Pro.</p>
          {METHODS.map((m) => (
            <div key={m.key} className="qcard"><b>{m.label}</b><div className="small">{m.info ?? "—"}</div></div>
          ))}
          {wa && <a className="btn btn-ghost btn-sm" href={`https://wa.me/${wa}?text=${encodeURIComponent("Assalam-o-Alaikum, I sent payment for PaperMaker Pro.")}`} target="_blank" rel="noreferrer">Need help? WhatsApp us</a>}
        </div>

        <form className="card" style={{ marginTop: 14 }} onSubmit={submit}>
          <h2>Submit payment</h2>
          {msg && <div className="alert">{msg}</div>}
          <div className="field"><label>Paid via</label><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}</select></div>
          <div className="field"><label>Transaction ID (TID)</label><input required minLength={4} value={f.transactionId} onChange={(e) => setF({ ...f, transactionId: e.target.value })} /></div>
          <div className="field"><label>Months</label><select value={f.months} onChange={(e) => setF({ ...f, months: Number(e.target.value) })}>{[1, 3, 6, 12].map((m) => <option key={m} value={m}>{m} — Rs {(PRICE * m).toLocaleString()}</option>)}</select></div>
          <div className="grid2">
            <div className="field"><label>Sender name</label><input value={f.payerName} onChange={(e) => setF({ ...f, payerName: e.target.value })} /></div>
            <div className="field"><label>Sender phone</label><input value={f.payerPhone} onChange={(e) => setF({ ...f, payerPhone: e.target.value })} /></div>
          </div>
          <button>Submit for verification</button>
        </form>
      </div>

      {b.payments.length > 0 && (
        <div className="card">
          <h3>Your submissions</h3>
          <table className="tbl">
            <thead><tr><th>Date</th><th>Method</th><th>TID</th><th>Amount</th><th>Status</th></tr></thead>
            <tbody>{b.payments.map((p) => (
              <tr key={p.id}><td>{new Date(p.createdAt).toLocaleDateString("en-GB")}</td><td>{p.method}</td><td>{p.transactionId}</td><td>Rs {p.amount.toLocaleString()} ({p.months} mo)</td>
                <td><span className={`badge ${p.status === "APPROVED" ? "ok" : p.status === "REJECTED" ? "danger" : "warn"}`}>{p.status}</span> {p.note && <span className="small muted">{p.note}</span>}</td></tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
