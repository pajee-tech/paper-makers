"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/useCatalog";

interface Payment {
  id: string; method: string; transactionId: string; amount: number; months: number; payerName?: string; payerPhone?: string;
  status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string;
  institution: { id: string; name: string; city?: string; plan: string; proUntil?: string; papersCreated: number };
}
interface Inst { id: string; name: string; city?: string; type: string; plan: string; proUntil?: string; papersCreated: number; createdAt: string; _count: { users: number } }

export default function AdminPage() {
  const [data, setData] = useState<{ payments: Payment[]; institutions: Inst[] } | null>(null);
  const [filter, setFilter] = useState("PENDING");
  const [msg, setMsg] = useState("");
  const load = () => api<{ payments: Payment[]; institutions: Inst[] }>(`/api/admin/payments${filter ? `?status=${filter}` : ""}`, "GET").then(setData);
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (body: object) => {
    try { await api("/api/admin/payments", "PATCH", body); setMsg("Done ✔"); load(); } catch (e) { setMsg((e as Error).message); }
  };

  if (!data) return <p className="muted">Loading…</p>;
  return (
    <div>
      <h1>Super Admin</h1>
      {msg && <div className="alert">{msg}</div>}
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>Payment verification</h2>
          <span className="spacer" />
          <select style={{ width: 160 }} value={filter} onChange={(e) => setFilter(e.target.value)}>
            <option value="PENDING">Pending</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="">All</option>
          </select>
        </div>
        <p className="small muted">Match each Transaction ID with your JazzCash / EasyPaisa / bank statement before approving.</p>
        <table className="tbl">
          <thead><tr><th>Date</th><th>Institution</th><th>Method</th><th>TID</th><th>Amount</th><th>Sender</th><th>Status</th><th /></tr></thead>
          <tbody>
            {data.payments.map((p) => (
              <tr key={p.id}>
                <td>{new Date(p.createdAt).toLocaleString("en-GB")}</td>
                <td>{p.institution.name} <span className="small muted">{p.institution.city}</span></td>
                <td>{p.method}</td><td><code>{p.transactionId}</code></td><td>Rs {p.amount.toLocaleString()} · {p.months} mo</td>
                <td className="small">{p.payerName} {p.payerPhone}</td>
                <td><span className={`badge ${p.status === "APPROVED" ? "ok" : p.status === "REJECTED" ? "danger" : "warn"}`}>{p.status}</span></td>
                <td>
                  {p.status === "PENDING" && (
                    <div className="row" style={{ gap: 4 }}>
                      <button className="btn-sm" onClick={() => act({ action: "approve", paymentId: p.id })}>Approve → PRO</button>
                      <button className="btn-danger btn-sm" onClick={() => act({ action: "reject", paymentId: p.id, note: prompt("Reason (shown to customer)") ?? undefined })}>Reject</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!data.payments.length && <tr><td colSpan={8} className="muted">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>Institutions ({data.institutions.length})</h2>
        <table className="tbl">
          <thead><tr><th>Name</th><th>Type</th><th>Joined</th><th>Users</th><th>Papers</th><th>Plan</th><th>Pro toggle</th></tr></thead>
          <tbody>
            {data.institutions.map((i) => (
              <tr key={i.id}>
                <td>{i.name} <span className="small muted">{i.city}</span></td><td>{i.type}</td><td>{new Date(i.createdAt).toLocaleDateString("en-GB")}</td>
                <td>{i._count.users}</td><td>{i.papersCreated}</td>
                <td><span className={`badge ${i.plan === "PAPER_MAKER_PRO" ? "ok" : "warn"}`}>{i.plan === "PAPER_MAKER_PRO" ? "PRO" : "TRIAL"}</span> {i.proUntil && <span className="small muted">until {new Date(i.proUntil).toLocaleDateString("en-GB")}</span>}</td>
                <td>
                  <label className="check">
                    <input type="checkbox" checked={i.plan === "PAPER_MAKER_PRO"} onChange={(e) => act(e.target.checked ? { action: "setPlan", institutionId: i.id, plan: "PAPER_MAKER_PRO", months: Number(prompt("Months of Pro?", "1")) || 1 } : { action: "setPlan", institutionId: i.id, plan: "FREE_TRIAL" })} />
                    PAPER_MAKER_PRO
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
