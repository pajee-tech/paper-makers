"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/useCatalog";
import { fileToCompressed } from "@/lib/clientImage";
import PasswordInput from "@/components/PasswordInput";

interface Inst {
  name: string; city: string | null; address: string | null; phone: string | null; logoDataUrl: string | null;
  users: { id: string; name: string; email: string; role: string }[];
}

export default function SettingsPage() {
  const [inst, setInst] = useState<Inst | null>(null);
  const [t, setT] = useState({ name: "", email: "", password: "" });
  const [msg, setMsg] = useState("");
  const load = () => api<{ institution: Inst }>("/api/institution", "GET").then((d) => setInst(d.institution));
  useEffect(() => { load(); }, []);
  if (!inst) return <p className="muted">Loading…</p>;

  const save = async () => {
    try {
      await api("/api/institution", "PUT", { name: inst.name, city: inst.city, address: inst.address, phone: inst.phone, logoDataUrl: inst.logoDataUrl });
      setMsg("Saved ✔ — new papers will show these details.");
    } catch (e) { setMsg((e as Error).message); }
  };

  return (
    <div>
      <h1>Settings</h1>
      {msg && <div className="alert">{msg}</div>}
      <div className="grid2">
        <div className="card">
          <h2>Institution (printed on papers)</h2>
          <div className="field"><label>Name</label><input value={inst.name} onChange={(e) => setInst({ ...inst, name: e.target.value })} /></div>
          <div className="field"><label>Address</label><input value={inst.address ?? ""} onChange={(e) => setInst({ ...inst, address: e.target.value })} /></div>
          <div className="grid2">
            <div className="field"><label>City</label><input value={inst.city ?? ""} onChange={(e) => setInst({ ...inst, city: e.target.value })} /></div>
            <div className="field"><label>Phone</label><input value={inst.phone ?? ""} onChange={(e) => setInst({ ...inst, phone: e.target.value })} /></div>
          </div>
          <div className="row">
            <label className="btn btn-ghost btn-sm" style={{ margin: 0, color: "var(--brand)" }}>
              Upload logo
              <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) setInst({ ...inst, logoDataUrl: await fileToCompressed(f, 300, 0.8) }); }} />
            </label>
            {inst.logoDataUrl && <><img src={inst.logoDataUrl} alt="" style={{ height: 40 }} /><button className="btn-danger btn-sm" onClick={() => setInst({ ...inst, logoDataUrl: null })}>Remove</button></>}
          </div>
          <button style={{ marginTop: 12 }} onClick={save}>Save</button>
          <div style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 12 }}>
            <b>Classes & subjects</b>
            <p className="small muted">Adds any missing standard class (Playgroup → BS Hons) and its subjects. Your own classes and subjects are kept.</p>
            <button className="btn-ghost btn-sm" onClick={async () => { const r = await api<{ addedClasses: number; addedSubjects: number }>("/api/catalog", "POST", { kind: "seed" }); setMsg(`Added ${r.addedClasses} classes and ${r.addedSubjects} subjects ✔`); }}>Load standard classes & subjects</button>
          </div>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <h2>Teachers</h2>
          <table className="tbl"><tbody>{inst.users.map((u) => (
            <tr key={u.id}>
              <td>{u.name}</td><td>{u.email}</td><td><span className="badge">{u.role.replace("_", " ")}</span></td>
              <td>
                {u.role === "TEACHER" && (
                  <div className="row" style={{ gap: 4 }}>
                    <button className="btn-ghost btn-sm" onClick={async () => { const pw = prompt(`New password for ${u.name} (min 8 characters)`); if (pw && pw.length >= 8) { try { await api("/api/institution", "PATCH", { userId: u.id, password: pw }); setMsg(`Password changed for ${u.name} ✔ — tell them the new password.`); } catch (e) { setMsg((e as Error).message); } } }}>Set password</button>
                    <button className="btn-danger btn-sm" onClick={async () => { if (confirm(`Remove ${u.name}?`)) { await api(`/api/institution?userId=${u.id}`, "DELETE"); load(); } }}>Remove</button>
                  </div>
                )}
              </td>
            </tr>
          ))}</tbody></table>
          <h3 style={{ marginTop: 14 }}>Add a teacher</h3>
          <div className="field"><input placeholder="Name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></div>
          <div className="field"><input placeholder="Email" type="email" value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} /></div>
          <div className="field"><PasswordInput placeholder="Temporary password (min 8)" value={t.password} onChange={(v) => setT({ ...t, password: v })} minLength={8} required={false} autoComplete="new-password" /></div>
          <button onClick={async () => { try { await api("/api/institution", "POST", t); setT({ name: "", email: "", password: "" }); setMsg("Teacher added ✔"); load(); } catch (e) { setMsg((e as Error).message); } }}>Add teacher</button>
        </div>
      </div>
    </div>
  );
}
