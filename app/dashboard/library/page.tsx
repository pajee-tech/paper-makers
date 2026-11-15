"use client";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { cachedGet } from "@/lib/clientCache";
import { LEVEL_LABEL, type Level } from "@/lib/types";

interface BookRow {
  id: string; title: string; board: string | null; edition: string | null; level: Level; className: string; subjectName: string; language: string;
  pageCount: number; status: string; shared: boolean; _count: { chapters: number; items: number };
}

export default function LibraryPage() {
  const [books, setBooks] = useState<BookRow[] | null>(null);
  const [err, setErr] = useState("");
  const [level, setLevel] = useState("");
  const [q, setQ] = useState("");
  useEffect(() => { cachedGet<{ books: BookRow[] }>("/api/books").then((d) => setBooks(d.books)).catch((e) => setErr(e.message)); }, []);
  const list = useMemo(() => (books ?? []).filter((b) => (!level || b.level === level) && (!q || `${b.title} ${b.subjectName} ${b.className}`.toLowerCase().includes(q.toLowerCase()))), [books, level, q]);

  return (
    <div>
      <div className="row" style={{ marginBottom: 12 }}>
        <h1 style={{ margin: 0 }}>Textbook & Syllabus Library</h1>
        <span className="spacer" />
        <Link className="btn" href="/dashboard/library/upload">+ Add book / syllabus</Link>
      </div>
      {err && <div className="alert err">{err} {err.includes("Pro") && <Link href="/dashboard/billing">Upgrade →</Link>}</div>}
      <div className="card">
        <div className="row">
          <select style={{ width: 240 }} value={level} onChange={(e) => setLevel(e.target.value)}>
            <option value="">All levels</option>
            {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
          <input style={{ flex: 1 }} placeholder="Search title, class or subject" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <p className="small muted">Books marked <span className="badge">Shared</span> are provided for all schools. Books you add are private to your institution. In <b>New Paper</b>, choose “From textbook” to pick questions by chapter, exercise and question number.</p>
        {books === null && !err ? <p className="muted">Loading…</p> : (
          <table className="tbl">
            <thead><tr><th>Book</th><th>Class</th><th>Subject</th><th>Board</th><th>Pages</th><th>Chapters</th><th>Questions</th><th /></tr></thead>
            <tbody>
              {list.map((b) => (
                <tr key={b.id}>
                  <td><Link href={`/dashboard/library/${b.id}`}><b>{b.title}</b></Link> {b.shared && <span className="badge">Shared</span>} {b.status !== "READY" && <span className="badge warn">incomplete</span>}</td>
                  <td>{b.className}</td><td>{b.subjectName} {b.language === "ur" && <span className="badge">اردو</span>}</td><td className="small">{b.board} {b.edition}</td>
                  <td>{b.pageCount}</td><td>{b._count.chapters}</td><td>{b._count.items}</td>
                  <td><Link className="btn btn-sm btn-ghost" href={`/dashboard/library/${b.id}`}>Open</Link></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={8} className="muted">No books yet. Add your first class book or syllabus.</td></tr>}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
