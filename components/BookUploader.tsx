"use client";
// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * Upload a textbook / syllabus once → every page's text, chapters, topics, exercises and exercise
 * questions are stored in the database. The PDF itself never leaves the browser (zero storage cost).
 */
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { STANDARD_CLASSES } from "@/lib/curriculum";
import { detectChapterStarts, parseBook, type ChapterStart, type ParsedChapter, type RawPage } from "@/lib/bookParse";
import { loadPdfJs } from "@/lib/clientImage";
import { createOcr, ocrPage, pageText } from "@/lib/pdfText";
import { api } from "./useCatalog";
import { LEVEL_LABEL, QTYPE_SHORT, type Level } from "@/lib/types";

const BOARDS = [
  "Punjab (PCTB)", "Federal (NBF)", "KP (KPTBB)", "Sindh (STBB)", "Balochistan (BTBB)", "AJK", "Single National Curriculum (SNC)",
  "Oxford University Press", "Cambridge", "Gaba / Paramount / other private publisher", "University / HEC course outline", "Own notes / syllabus",
];

export default function BookUploader({ isSuper }: { isSuper: boolean }) {
  const router = useRouter();
  const [meta, setMeta] = useState({ className: "9th", subjectName: "", title: "", board: BOARDS[0], edition: "", language: "en" as "en" | "ur", shared: isSuper });
  const [ocr, setOcr] = useState<"off" | "eng" | "urd" | "eng+urd">("off");
  const [pages, setPages] = useState<RawPage[]>([]);
  const [starts, setStarts] = useState<ChapterStart[]>([]);
  const [chapters, setChapters] = useState<ParsedChapter[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number; msg: string } | null>(null);
  const [err, setErr] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const cancel = useRef(false);

  const std = STANDARD_CLASSES.find((c) => c.name === meta.className);
  const level: Level = std?.level ?? "MATRIC";
  const emptyPages = pages.filter((p) => p.text.length < 40).length;
  const totals = useMemo(() => ({
    exercises: chapters.reduce((a, c) => a + c.exercises.length, 0),
    items: chapters.reduce((a, c) => a + c.exercises.reduce((b, e) => b + e.items.length, 0), 0),
    mcqs: chapters.reduce((a, c) => a + c.exercises.reduce((b, e) => b + e.items.filter((i) => i.type === "MCQ").length, 0), 0),
    answered: chapters.reduce((a, c) => a + c.exercises.reduce((b, e) => b + e.items.filter((i) => i.type === "MCQ" && i.correctOption != null).length, 0), 0),
  }), [chapters]);

  async function readPdf(file: File) {
    setErr("");
    cancel.current = false;
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const out: RawPage[] = [];
    const worker = ocr !== "off" ? (setProgress({ done: 0, total: doc.numPages, msg: "Loading free OCR engine…" }), await createOcr(ocr)) : null;
    try {
      for (let n = 1; n <= doc.numPages; n++) {
        if (cancel.current) break;
        setProgress({ done: n - 1, total: doc.numPages, msg: `Reading page ${n} of ${doc.numPages}…` });
        const p = await doc.getPage(n);
        let text = await pageText(p);
        let usedOcr = false;
        if (worker && text.replace(/\s/g, "").length < 40) {
          setProgress({ done: n - 1, total: doc.numPages, msg: `OCR on scanned page ${n} of ${doc.numPages} (slow)…` });
          text = await ocrPage(p, worker);
          usedOcr = true;
        }
        out.push({ pageNo: n, text: usedOcr ? `[[OCR]]\n${text}` : text });
        p.cleanup();
      }
    } finally {
      await worker?.terminate();
      setProgress(null);
    }
    const clean = out.map((p) => ({ pageNo: p.pageNo, text: p.text.replace(/^\[\[OCR\]\]\n/, "") }));
    setPages(clean);
    const s = detectChapterStarts(clean);
    setStarts(s);
    setChapters(parseBook(clean, s.length ? s : undefined));
    if (!meta.title) setMeta((m) => ({ ...m, title: file.name.replace(/\.pdf$/i, "").replace(/[_-]+/g, " ") }));
  }

  const reparse = (s: ChapterStart[]) => { setStarts(s); setChapters(parseBook(pages, s.length ? s : undefined)); };

  async function save() {
    setErr("");
    if (!meta.subjectName.trim()) return setErr("Choose the subject");
    if (!meta.title.trim()) return setErr("Give the book a title");
    try {
      setProgress({ done: 0, total: pages.length, msg: "Creating book…" });
      const { id } = await api<{ id: string }>("/api/books", "POST", {
        title: meta.title, board: meta.board, edition: meta.edition || undefined, level, className: meta.className, subjectName: meta.subjectName,
        language: meta.language, pageCount: pages.length, shared: isSuper && meta.shared,
      });
      for (let i = 0; i < pages.length; i += 25) {
        setProgress({ done: i, total: pages.length, msg: `Saving pages ${i + 1}–${Math.min(i + 25, pages.length)}…` });
        await api(`/api/books/${id}/pages`, "POST", { replace: i === 0, pages: pages.slice(i, i + 25).map((p) => ({ pageNo: p.pageNo, text: p.text.slice(0, 60000) })) });
      }
      setProgress({ done: pages.length, total: pages.length, msg: "Saving chapters, exercises and questions…" });
      await api(`/api/books/${id}/structure`, "PUT", {
        chapters: chapters.map((c) => ({
          number: c.number, title: c.title, startPage: c.startPage, endPage: c.endPage, topics: c.topics.slice(0, 200),
          exercises: c.exercises.map((e) => ({ title: e.title.slice(0, 200), startPage: e.startPage, endPage: e.endPage, items: e.items.slice(0, 800).map((it) => ({ qNo: it.qNo, pageNo: it.pageNo, type: it.type, text: it.text.slice(0, 5000), options: it.options ?? null, correctOption: it.correctOption ?? null, answer: it.answer ?? null, topic: it.topic ?? null, source: it.source })) })),
        })),
      });
      router.push(`/dashboard/library/${id}`);
    } catch (e) {
      setErr((e as Error).message);
      setProgress(null);
    }
  }

  return (
    <div>
      {err && <div className="alert err">{err}</div>}
      <div className="card">
        <h2>1. Book details</h2>
        <div className="grid3">
          <div className="field">
            <label>Class</label>
            <select value={meta.className} onChange={(e) => setMeta({ ...meta, className: e.target.value, subjectName: "" })}>
              {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => (
                <optgroup key={l} label={LEVEL_LABEL[l]}>
                  {STANDARD_CLASSES.filter((c) => c.level === l).map((c) => <option key={c.name}>{c.name}</option>)}
                </optgroup>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Subject</label>
            <input list="std-subjects" value={meta.subjectName} placeholder="Pick or type" onChange={(e) => setMeta({ ...meta, subjectName: e.target.value, language: /urdu|اردو|tarjuma|nazra/i.test(e.target.value) ? "ur" : meta.language })} />
            <datalist id="std-subjects">{std?.subjects.map((s) => <option key={s.name} value={s.name} />)}</datalist>
          </div>
          <div className="field"><label>Board / publisher</label><select value={meta.board} onChange={(e) => setMeta({ ...meta, board: e.target.value })}>{BOARDS.map((b) => <option key={b}>{b}</option>)}</select></div>
          <div className="field"><label>Book title</label><input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} placeholder="Physics 9 (New Syllabus)" /></div>
          <div className="field"><label>Edition / year</label><input value={meta.edition} onChange={(e) => setMeta({ ...meta, edition: e.target.value })} placeholder="2025-26" /></div>
          <div className="field"><label>Language</label><select value={meta.language} onChange={(e) => setMeta({ ...meta, language: e.target.value as "en" | "ur" })}><option value="en">English</option><option value="ur">Urdu (RTL)</option></select></div>
        </div>
        {isSuper && <label className="check"><input type="checkbox" checked={meta.shared} onChange={(e) => setMeta({ ...meta, shared: e.target.checked })} /> Add to the <b>shared platform library</b> (every school can use it)</label>}
      </div>

      <div className="card">
        <h2>2. Textbook or syllabus PDF</h2>
        <div className="row">
          <div style={{ width: 260 }}>
            <label>Scanned pages (no selectable text)</label>
            <select value={ocr} onChange={(e) => setOcr(e.target.value as typeof ocr)}>
              <option value="off">Skip OCR (fast)</option>
              <option value="eng">OCR in English (slow)</option>
              <option value="urd">OCR in Urdu (slow)</option>
              <option value="eng+urd">OCR English + Urdu (slowest)</option>
            </select>
          </div>
          <label className="btn" style={{ margin: 0, color: "#fff" }}>
            📘 Choose PDF
            <input type="file" hidden accept="application/pdf" disabled={!!progress} onChange={(e) => e.target.files?.[0] && readPdf(e.target.files[0])} />
          </label>
          <span className="small muted">Read inside your browser — the PDF is not uploaded, only its text.</span>
        </div>
        {progress && (
          <div className="alert ok" style={{ marginTop: 10 }}>
            {progress.msg}
            {progress.total > 0 && <progress style={{ width: "100%" }} value={progress.done} max={progress.total} />}
            <button className="btn-danger btn-sm" onClick={() => (cancel.current = true)}>Stop</button>
          </div>
        )}
        {pages.length > 0 && (
          <p className="small" style={{ marginTop: 10 }}>
            <b>{pages.length}</b> pages read · {emptyPages > 0 ? <span style={{ color: "var(--warn)" }}>{emptyPages} pages had no text (scanned / InPage Urdu). Choose an OCR option and pick the PDF again, or add those questions manually later.</span> : "all pages have text ✔"}
          </p>
        )}
      </div>

      {pages.length > 0 && (
        <div className="card">
          <div className="row">
            <h2 style={{ margin: 0 }}>3. Check chapters & exercises</h2>
            <span className="spacer" />
            <span className="badge">{chapters.length} chapters</span><span className="badge">{totals.exercises} exercises</span><span className="badge ok">{totals.items} questions</span>
            {totals.mcqs > 0 && <span className={`badge ${totals.answered === totals.mcqs ? "ok" : "warn"}`} title="Correct answers found in the book's answer keys. Add the rest later with 🔑 Answer key in Book Library.">{totals.answered}/{totals.mcqs} MCQ answers found</span>}
          </div>
          <p className="small muted">Fix chapter names and the page each chapter starts on (PDF page numbers), then press “Re-read”. Exercises and their questions are found automatically inside each chapter.</p>
          <table className="tbl">
            <thead><tr><th style={{ width: 70 }}>No.</th><th>Chapter title</th><th style={{ width: 110 }}>Starts at PDF page</th><th style={{ width: 90 }}>Ends</th><th>Found</th><th /></tr></thead>
            <tbody>
              {(starts.length ? starts : chapters.map((c) => ({ number: c.number, title: c.title, startPage: c.startPage }))).map((s, i) => {
                const c = chapters.find((x) => x.startPage === s.startPage) ?? chapters[i];
                const list = starts.length ? starts : chapters.map((x) => ({ number: x.number, title: x.title, startPage: x.startPage }));
                const upd = (patch: Partial<ChapterStart>) => setStarts(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
                return (
                  <tr key={i}>
                    <td><input type="number" value={s.number} onChange={(e) => upd({ number: Number(e.target.value) })} /></td>
                    <td><input value={s.title} onChange={(e) => upd({ title: e.target.value })} /></td>
                    <td><input type="number" min={1} max={pages.length} value={s.startPage} onChange={(e) => upd({ startPage: Number(e.target.value) })} /></td>
                    <td>{c?.endPage ?? "—"}</td>
                    <td className="small">{c ? `${c.topics.length} topics · ${c.exercises.length} exercises · ${c.exercises.reduce((a, e) => a + e.items.length, 0)} Qs` : ""} {c && <button className="btn-ghost btn-sm" onClick={() => setOpen(open === c.tempId ? null : c.tempId)}>{open === c.tempId ? "Hide" : "Preview"}</button>}</td>
                    <td><button className="btn-danger btn-sm" onClick={() => setStarts(list.filter((_, j) => j !== i))}>✕</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="row" style={{ marginTop: 8 }}>
            <button className="btn-ghost btn-sm" onClick={() => { const list = starts.length ? starts : chapters.map((x) => ({ number: x.number, title: x.title, startPage: x.startPage })); setStarts([...list, { number: list.length + 1, title: `Chapter ${list.length + 1}`, startPage: pages.length }]); }}>+ Add chapter</button>
            <button className="btn-sm" onClick={() => reparse([...starts].sort((a, b) => a.startPage - b.startPage))}>↻ Re-read with these chapters</button>
            <button className="btn-ghost btn-sm" onClick={() => reparse(detectChapterStarts(pages))}>Auto-detect again</button>
          </div>

          {chapters.filter((c) => c.tempId === open).map((c) => (
            <div key={c.tempId} className="qcard" style={{ marginTop: 12 }}>
              <b>Ch {c.number}: {c.title}</b> <span className="small muted">pages {c.startPage}–{c.endPage}</span>
              {c.topics.length > 0 && <div className="small muted" style={{ margin: "4px 0" }}>Topics: {c.topics.join(" · ")}</div>}
              {c.exercises.map((e) => (
                <div key={e.tempId} style={{ marginTop: 6 }}>
                  <div className="small"><b>{e.title}</b> (p{e.startPage}–{e.endPage}) — {e.items.length} questions</div>
                  <ol className="small" style={{ margin: "2px 0 0", paddingLeft: 20 }}>
                    {e.items.slice(0, 12).map((it) => <li key={it.tempId}><span className="badge">{QTYPE_SHORT[it.type]}</span> <b>{it.qNo}</b> {it.text.slice(0, 120)}</li>)}
                    {e.items.length > 12 && <li className="muted">…and {e.items.length - 12} more</li>}
                  </ol>
                </div>
              ))}
              {!c.exercises.length && <div className="small muted">No exercise headings found in this chapter. You can still add questions from its pages after saving.</div>}
            </div>
          ))}
        </div>
      )}

      {pages.length > 0 && (
        <div className="card row" style={{ position: "sticky", bottom: 0, zIndex: 3 }}>
          <span className="small">{meta.className} · {meta.subjectName || "subject?"} · {pages.length} pages · {totals.items} questions</span>
          <span className="spacer" />
          <button disabled={!!progress} onClick={save}>💾 Save book to library</button>
        </div>
      )}
    </div>
  );
}
