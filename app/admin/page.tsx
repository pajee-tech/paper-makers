"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/components/useCatalog";
import type { PlatformSettings } from "@/lib/settings";

interface Payment {
  id: string; method: string; transactionId: string; amount: number; months: number; planKey?: string; payerName?: string; payerPhone?: string;
  status: "PENDING" | "APPROVED" | "REJECTED"; createdAt: string;
  institution: { id: string; name: string; city?: string; plan: string; proUntil?: string; papersCreated: number };
}
interface Inst { id: string; name: string; city?: string; type: string; plan: string; proUntil?: string; papersCreated: number; createdAt: string; _count: { users: number } }
interface UserRow { id: string; name: string; email: string; role: string; createdAt: string; institution?: { name: string; city?: string } }

export default function AdminPage() {
  const [tab, setTab] = useState<"payments" | "institutions" | "users" | "settings">("payments");
  const [data, setData] = useState<{ payments: Payment[]; institutions: Inst[] } | null>(null);
  const [filter, setFilter] = useState("PENDING");
  const [msg, setMsg] = useState("");
  const load = () => api<{ payments: Payment[]; institutions: Inst[] }>(`/api/admin/payments${filter ? `?status=${filter}` : ""}`, "GET").then(setData);
  useEffect(() => { load(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const act = async (body: object) => {
    try { await api("/api/admin/payments", "PATCH", body); setMsg("Done ✔"); load(); } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div>
      <div className="row"><h1 style={{ margin: 0 }}>Super Admin</h1><span className="spacer" /><Link className="btn btn-ghost" href="/dashboard/library/upload">+ Add book to shared library</Link></div>
      <div className="tabs" style={{ marginTop: 10 }}>
        {(["payments", "institutions", "users", "settings"] as const).map((t) => (
          <button key={t} className={tab === t ? "active" : ""} onClick={() => setTab(t)}>{{ payments: "💳 Payments", institutions: "🏫 Institutions", users: "👤 Users & passwords", settings: "⚙️ Trial & Pro settings" }[t]}</button>
        ))}
      </div>
      {msg && <div className="alert">{msg}</div>}

      {tab === "payments" && data && (
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
            <thead><tr><th>Date</th><th>Institution</th><th>Plan</th><th>Method</th><th>TID</th><th>Amount</th><th>Sender</th><th>Status</th><th /></tr></thead>
            <tbody>
              {data.payments.map((p) => (
                <tr key={p.id}>
                  <td>{new Date(p.createdAt).toLocaleString("en-GB")}</td>
                  <td>{p.institution.name} <span className="small muted">{p.institution.city}</span></td>
                  <td>{p.planKey ?? "—"} · {p.months} mo</td>
                  <td>{p.method}</td><td><code>{p.transactionId}</code></td><td>Rs {p.amount.toLocaleString()}</td>
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
              {!data.payments.length && <tr><td colSpan={9} className="muted">Nothing here.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {tab === "institutions" && data && (
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
      )}

      {tab === "users" && <UsersTab />}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}

function UsersTab() {
  const [q, setQ] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [link, setLink] = useState<{ email: string; link: string } | null>(null);
  const search = () => api<{ users: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q)}`, "GET").then((d) => setUsers(d.users));
  useEffect(() => { search(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="card">
      <h2>Users & password resets</h2>
      <p className="small muted">When a user forgets the password (and email sending is not set up), create a one-time reset link here and send it to them on WhatsApp. The link works for 60 minutes.</p>
      <form className="row" onSubmit={(e) => { e.preventDefault(); search(); }}>
        <input style={{ flex: 1 }} placeholder="Search name or email" value={q} onChange={(e) => setQ(e.target.value)} />
        <button>Search</button>
      </form>
      {link && (
        <div className="alert ok" style={{ marginTop: 10 }}>
          Reset link for <b>{link.email}</b>:<br /><code style={{ wordBreak: "break-all" }}>{link.link}</code>
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn-sm" onClick={() => navigator.clipboard.writeText(link.link)}>Copy</button>
            <a className="btn btn-sm btn-ghost" target="_blank" rel="noreferrer" href={`https://wa.me/?text=${encodeURIComponent(`Your password reset link (valid 60 minutes): ${link.link}`)}`}>Send on WhatsApp</a>
          </div>
        </div>
      )}
      <table className="tbl" style={{ marginTop: 10 }}>
        <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Institution</th><th>Joined</th><th /></tr></thead>
        <tbody>
          {users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td><td>{u.email}</td><td><span className="badge">{u.role}</span></td><td>{u.institution?.name} <span className="small muted">{u.institution?.city}</span></td>
              <td>{new Date(u.createdAt).toLocaleDateString("en-GB")}</td>
              <td><button className="btn-ghost btn-sm" onClick={async () => setLink(await api<{ link: string; email: string }>("/api/admin/users", "POST", { userId: u.id }))}>Create reset link</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsTab() {
  const [s, setS] = useState<PlatformSettings | null>(null);
  const [mail, setMail] = useState(false);
  const [msg, setMsg] = useState("");
  useEffect(() => { api<{ settings: PlatformSettings; mailConfigured: boolean }>("/api/admin/settings", "GET").then((d) => { setS(d.settings); setMail(d.mailConfigured); }); }, []);
  if (!s) return <p className="muted">Loading…</p>;
  const set = <K extends keyof PlatformSettings>(k: K, v: PlatformSettings[K]) => setS({ ...s, [k]: v });
  const num = (k: keyof PlatformSettings) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, Number(e.target.value) as never);
  const chk = (k: keyof PlatformSettings, label: string) => <label className="check"><input type="checkbox" checked={s[k] as boolean} onChange={(e) => set(k, e.target.checked as never)} /> {label}</label>;

  async function save() {
    setMsg("");
    try { await api("/api/admin/settings", "PUT", s); setMsg("Settings saved ✔ (live within 30 seconds)"); } catch (e) { setMsg((e as Error).message); }
  }

  return (
    <div>
      {msg && <div className="alert">{msg}</div>}
      <div className="grid2">
        <div className="card">
          <h2>Free trial</h2>
          <div className="grid2">
            <div className="field"><label>Free papers per new institution</label><input type="number" min={0} value={s.trialPaperLimit} onChange={num("trialPaperLimit")} /></div>
            <div className="field"><label>Trial length in days (0 = no limit)</label><input type="number" min={0} value={s.trialDays} onChange={num("trialDays")} /></div>
            <div className="field"><label>User accounts allowed in trial</label><input type="number" min={1} value={s.trialTeacherLimit} onChange={num("trialTeacherLimit")} /></div>
          </div>
          {chk("trialWatermark", "Watermark trial papers")}
          <div className="field" style={{ marginTop: 6 }}><label>Watermark text</label><input value={s.trialWatermarkText} onChange={(e) => set("trialWatermarkText", e.target.value)} /></div>
          {chk("trialAllowResults", "Trial can generate class results")}
          {chk("trialAllowOmrScan", "Trial can use OMR auto-count")}
          {chk("trialAllowLibrary", "Trial can use the textbook library")}
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <h2>Pro plans</h2>
          <table className="tbl">
            <thead><tr><th>Key</th><th>Name</th><th>Months</th><th>Price (Rs)</th><th>Badge</th><th /></tr></thead>
            <tbody>
              {s.plans.map((p, i) => {
                const up = (patch: Partial<typeof p>) => set("plans", s.plans.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={i}>
                    <td><input value={p.key} onChange={(e) => up({ key: e.target.value.replace(/\s/g, "") })} /></td>
                    <td><input value={p.name} onChange={(e) => up({ name: e.target.value })} /></td>
                    <td style={{ width: 70 }}><input type="number" min={1} value={p.months} onChange={(e) => up({ months: Number(e.target.value) })} /></td>
                    <td style={{ width: 100 }}><input type="number" min={0} value={p.pricePkr} onChange={(e) => up({ pricePkr: Number(e.target.value) })} /></td>
                    <td><input value={p.note ?? ""} onChange={(e) => up({ note: e.target.value || undefined })} /></td>
                    <td><button className="btn-danger btn-sm" disabled={s.plans.length <= 1} onClick={() => set("plans", s.plans.filter((_, j) => j !== i))}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <button className="btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => set("plans", [...s.plans, { key: `plan${s.plans.length + 1}`, name: "New plan", months: 1, pricePkr: 1000 }])}>+ Plan</button>
          <div className="field" style={{ marginTop: 10 }}><label>User accounts allowed on Pro</label><input type="number" min={1} value={s.proTeacherLimit} onChange={num("proTeacherLimit")} /></div>
          <div className="field"><label>Pro features (one per line, shown on Billing)</label><textarea rows={5} value={s.proFeatures.join("\n")} onChange={(e) => set("proFeatures", e.target.value.split("\n").map((x) => x.trim()).filter(Boolean))} /></div>
        </div>
      </div>

      <div className="card">
        <h2>Payment accounts & support</h2>
        <div className="grid3">
          <div className="field"><label>JazzCash (number + title)</label><input value={s.payJazzcash} onChange={(e) => set("payJazzcash", e.target.value)} /></div>
          <div className="field"><label>EasyPaisa (number + title)</label><input value={s.payEasypaisa} onChange={(e) => set("payEasypaisa", e.target.value)} /></div>
          <div className="field"><label>Bank (bank, IBAN, title)</label><input value={s.payBank} onChange={(e) => set("payBank", e.target.value)} /></div>
          <div className="field"><label>Support WhatsApp (923xxxxxxxxx)</label><input value={s.supportWhatsapp} onChange={(e) => set("supportWhatsapp", e.target.value.replace(/\D/g, ""))} /></div>
          <div className="field"><label>Support email</label><input value={s.supportEmail} onChange={(e) => set("supportEmail", e.target.value)} /></div>
          <div className="field"><label>App name</label><input value={s.appName} onChange={(e) => set("appName", e.target.value)} /></div>
        </div>
        <div className="field"><label>Payment instructions</label><textarea value={s.paymentInstructions} onChange={(e) => set("paymentInstructions", e.target.value)} /></div>
        <p className="small muted">Forgot-password emails: {mail ? <span className="badge ok">SMTP connected</span> : <>not set — add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in Vercel (free Gmail App Password works). Until then use <b>Users → Create reset link</b>.</>}</p>
      </div>
      <div className="card row" style={{ position: "sticky", bottom: 0 }}><span className="spacer" /><button onClick={save}>Save settings</button></div>
    </div>
  );
}
