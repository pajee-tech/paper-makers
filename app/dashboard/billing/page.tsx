"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/useCatalog";
import type { PublicSettings } from "@/lib/settings";

interface Billing {
  plan: "FREE_TRIAL" | "PAPER_MAKER_PRO";
  proUntil: string | null;
  used: number;
  limit: number;
  remaining: number | null;
  trialEndsAt: string | null;
  trialExpired: boolean;
  features: { results: boolean; omrScan: boolean; library: boolean };
  teacherLimit: number;
  payments: { id: string; method: string; transactionId: string; amount: number; months: number; planKey?: string; status: string; createdAt: string; note?: string }[];
}

export default function BillingPage() {
  const [b, setB] = useState<Billing | null>(null);
  const [st, setSt] = useState<PublicSettings | null>(null);
  const [f, setF] = useState({ method: "JAZZCASH", transactionId: "", planKey: "", payerName: "", payerPhone: "" });
  const [msg, setMsg] = useState("");
  const load = () => api<Billing>("/api/billing", "GET").then(setB);
  useEffect(() => {
    load();
    api<PublicSettings>("/api/settings", "GET").then((s) => { setSt(s); setF((x) => ({ ...x, planKey: s.plans[s.plans.length - 1]?.key ?? "" })); });
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setMsg("");
    try {
      await api("/api/billing", "POST", f);
      setMsg("Submitted ✔ — your account is upgraded as soon as the payment is verified.");
      setF({ ...f, transactionId: "" });
      load();
    } catch (err) { setMsg((err as Error).message); }
  }

  if (!b || !st) return <p className="muted">Loading…</p>;
  const methods = [
    { key: "JAZZCASH", label: "JazzCash", info: st.payJazzcash },
    { key: "EASYPAISA", label: "EasyPaisa", info: st.payEasypaisa },
    { key: "BANK", label: "Bank transfer", info: st.payBank },
  ].filter((m) => m.info);
  const plan = st.plans.find((p) => p.key === f.planKey);

  return (
    <div>
      <h1>Plans & Billing</h1>
      <div className="card">
        {b.plan === "PAPER_MAKER_PRO" ? (
          <p style={{ margin: 0 }}><span className="badge ok">PRO</span> Active{b.proUntil ? ` until ${new Date(b.proUntil).toLocaleDateString("en-GB")}` : ""}. Unlimited papers, no watermark, up to {b.teacherLimit} user accounts.</p>
        ) : (
          <p style={{ margin: 0 }}>
            <span className="badge warn">FREE TRIAL</span> {b.used} of {b.limit} free papers used
            {b.trialEndsAt && <> · trial {b.trialExpired ? "ended" : "ends"} on <b>{new Date(b.trialEndsAt).toLocaleDateString("en-GB")}</b></>}
            {" "}· up to {b.teacherLimit} user accounts
            {!b.features.results && " · class results are Pro-only"}
            {!b.features.library && " · textbook library is Pro-only"}
          </p>
        )}
      </div>

      <div className="grid3" style={{ marginTop: 14 }}>
        {st.plans.map((p) => (
          <div key={p.key} className="card" style={{ marginTop: 0, borderColor: f.planKey === p.key ? "var(--brand)" : undefined, borderWidth: f.planKey === p.key ? 2 : 1, cursor: "pointer" }} onClick={() => setF({ ...f, planKey: p.key })}>
            <div className="row"><h3 style={{ margin: 0 }}>{p.name}</h3>{p.note && <span className="badge ok">{p.note}</span>}</div>
            <div className="stat">Rs {p.pricePkr.toLocaleString()}</div>
            <div className="small muted">for {p.months} month{p.months > 1 ? "s" : ""} · Rs {Math.round(p.pricePkr / p.months).toLocaleString()}/month</div>
          </div>
        ))}
      </div>
      {st.proFeatures.length > 0 && (
        <div className="card"><b>Every Pro plan includes</b><ul style={{ margin: "6px 0 0" }}>{st.proFeatures.map((x) => <li key={x}>{x}</li>)}</ul></div>
      )}

      <div className="grid2">
        <div className="card" style={{ marginTop: 14 }}>
          <h2>How to pay</h2>
          <p className="muted small">{st.paymentInstructions}</p>
          {methods.map((m) => <div key={m.key} className="qcard"><b>{m.label}</b><div className="small">{m.info}</div></div>)}
          {!methods.length && <div className="alert">Payment accounts are not set yet — contact support.</div>}
          {st.supportWhatsapp && <a className="btn btn-ghost btn-sm" href={`https://wa.me/${st.supportWhatsapp}?text=${encodeURIComponent(`Assalam-o-Alaikum, I want to buy ${plan?.name ?? "Pro"} for ${st.appName}.`)}`} target="_blank" rel="noreferrer">Need help? WhatsApp us</a>}
        </div>

        <form className="card" style={{ marginTop: 14 }} onSubmit={submit}>
          <h2>Submit payment</h2>
          {msg && <div className="alert">{msg}</div>}
          <div className="field"><label>Plan</label><select value={f.planKey} onChange={(e) => setF({ ...f, planKey: e.target.value })}>{st.plans.map((p) => <option key={p.key} value={p.key}>{p.name} — Rs {p.pricePkr.toLocaleString()}</option>)}</select></div>
          <div className="field"><label>Paid via</label><select value={f.method} onChange={(e) => setF({ ...f, method: e.target.value })}>{["JAZZCASH", "EASYPAISA", "BANK"].map((m) => <option key={m} value={m}>{m === "BANK" ? "Bank transfer" : m === "JAZZCASH" ? "JazzCash" : "EasyPaisa"}</option>)}</select></div>
          <div className="field"><label>Transaction ID (TID)</label><input required minLength={4} value={f.transactionId} onChange={(e) => setF({ ...f, transactionId: e.target.value })} /></div>
          <div className="grid2">
            <div className="field"><label>Sender name</label><input value={f.payerName} onChange={(e) => setF({ ...f, payerName: e.target.value })} /></div>
            <div className="field"><label>Sender phone</label><input value={f.payerPhone} onChange={(e) => setF({ ...f, payerPhone: e.target.value })} /></div>
          </div>
          <button>Submit Rs {plan?.pricePkr.toLocaleString() ?? ""} for verification</button>
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
