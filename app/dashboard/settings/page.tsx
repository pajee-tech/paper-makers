"use client";
import { useEffect, useState } from "react";
import { api } from "@/components/useCatalog";
import { fileToCompressed } from "@/lib/clientImage";

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
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          <h2>Teachers</h2>
          <table className="tbl"><tbody>{inst.users.map((u) => <tr key={u.id}><td>{u.name}</td><td>{u.email}</td><td><span className="badge">{u.role.replace("_", " ")}</span></td></tr>)}</tbody></table>
          <h3 style={{ marginTop: 14 }}>Add a teacher</h3>
          <div className="field"><input placeholder="Name" value={t.name} onChange={(e) => setT({ ...t, name: e.target.value })} /></div>
          <div className="field"><input placeholder="Email" type="email" value={t.email} onChange={(e) => setT({ ...t, email: e.target.value })} /></div>
          <div className="field"><input placeholder="Temporary password (min 8)" value={t.password} onChange={(e) => setT({ ...t, password: e.target.value })} /></div>
          <button onClick={async () => { try { await api("/api/institution", "POST", t); setT({ name: "", email: "", password: "" }); setMsg("Teacher added ✔"); load(); } catch (e) { setMsg((e as Error).message); } }}>Add teacher</button>
        </div>
      </div>
    </div>
  );
}
