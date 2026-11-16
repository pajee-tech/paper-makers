"use client";
// Copyright (c) Pajee Technologies. All rights reserved.
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MathText from "./MathText";
import QuestionForm, { cleanDraft, emptyDraft, type DraftQuestion } from "./QuestionForm";
import { detectQuestions } from "./PdfBookPaperExtractor";
import { api } from "./useCatalog";
import { cachedGet } from "@/lib/clientCache";
import { generateFromText, parseBook, parseNumberList, structurePayload, type ParsedItem } from "@/lib/bookParse";
import { ocrLangFor, readPdfPages } from "@/lib/pdfText";
import { QTYPE_LABEL, type QType } from "@/lib/types";

export interface BookMeta { id: string; title: string; board?: string | null; edition?: string | null; className: string; subjectName: string; language: string; pageCount: number; shared: boolean; canEdit: boolean }
export interface BookExerciseDTO { id: string; title: string; startPage: number; endPage: number; _count: { items: number } }
export interface BookChapterDTO { id: string; number: number; title: string; isAlp?: boolean; startPage: number; endPage: number; topics: string[] | null; exercises: BookExerciseDTO[]; _count: { items: number }; generatedCount: number }
export interface BookItemDTO extends DraftQuestion { id: string; chapterId: string; exerciseId: string | null; pageNo: number | null; qNo: string | null; topic: string | null; source: string }

export default function BookViewer({ bookId }: { bookId: string }) {
  const router = useRouter();
  const [book, setBook] = useState<BookMeta | null>(null);
  const [chapters, setChapters] = useState<BookChapterDTO[]>([]);
  const [chId, setChId] = useState("");
  const [items, setItems] = useState<BookItemDTO[]>([]);
  const [tab, setTab] = useState<"questions" | "pages" | "generate" | "search">("questions");
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<DraftQuestion | null>(null);
  const [msg, setMsg] = useState("");

  const chaptersRef = useRef<BookChapterDTO[]>([]);
  const loadBook = useCallback(async () => {
    const d = await cachedGet<{ book: BookMeta; chapters: BookChapterDTO[] }>(`/api/books/${bookId}`);
    setBook(d.book);
    // a re-read saves chapters with new IDs: stay on the same chapter number instead of showing an empty page
    const before = chaptersRef.current;
    chaptersRef.current = d.chapters;
    setChapters(d.chapters);
    setChId((cur) => {
      if (cur && d.chapters.some((c) => c.id === cur)) return cur;
      const num = before.find((c) => c.id === cur)?.number;
      return d.chapters.find((c) => c.number === num)?.id ?? d.chapters[0]?.id ?? "";
    });
  }, [bookId]);
  const loadItems = useCallback(async () => {
    if (!chId) return;
    const d = await cachedGet<{ items: BookItemDTO[] }>(`/api/books/${bookId}/items?full=1&chapterIds=${chId}`);
    setItems(d.items);
  }, [bookId, chId]);
  useEffect(() => { loadBook().catch((e) => setMsg(e.message)); }, [loadBook]);
  useEffect(() => { loadItems(); }, [loadItems]);

  const ch = chapters.find((c) => c.id === chId);
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };
  const refresh = () => Promise.all([loadItems(), loadBook()]);

  async function addItems(list: DraftQuestion[], source: "MANUAL" | "GENERATED", exerciseId?: string | null, extra?: Partial<ParsedItem>[]) {
    if (!ch || !list.length) return false;
    try {
      const r = await api<{ created: number }>(`/api/books/${bookId}/items`, "POST", {
        chapterId: ch.id, exerciseId: exerciseId ?? null, source,
        items: list.map((d, i) => ({ ...cleanDraft(d), pageNo: extra?.[i]?.pageNo ?? null, qNo: (extra?.[i]?.qNo || "").slice(0, 30) || null })),
      });
      await refresh();
      flash(`${r.created ?? list.length} question(s) added ✔`);
      return true;
    } catch (e) {
      setMsg(`Questions were not saved: ${(e as Error).message}`);
      return false;
    }
  }

  /** Re-reads every saved page with the latest reader (removes page numbers / footers, fixes split MCQ options). */
  async function reRead(fromPdf?: File) {
    if (!book) return;
    if (!fromPdf && !confirm("Re-read all questions of this book from its saved pages?\n\nTeacher-added and auto-generated questions, Smart Syllabus marks and questions already used in papers are kept.")) return;
    try {
      let pages: { pageNo: number; text: string }[] = [];
      if (fromPdf) {
        // scanned / Urdu books: read the PDF again with OCR, then replace the saved page text
        const r = await readPdfPages(fromPdf, { mode: "auto", lang: ocrLangFor(book.language), onProgress: (p) => setMsg(p.msg), stopped: () => false });
        if (r.ocrError) setMsg(`OCR could not run: ${r.ocrError}`);
        pages = r.pages;
        setMsg("Saving page text…");
        for (let i = 0; i < r.pages.length; i += 25) {
          await api(`/api/books/${bookId}/pages`, "POST", { replace: i === 0, pages: r.pages.slice(i, i + 25).map((p) => ({ pageNo: p.pageNo, text: p.text.slice(0, 60000), ocr: p.ocr })) });
        }
      } else {
        setMsg("Reading saved pages…");
        for (let p = 1; p <= book.pageCount; p += 31) {
          const d = await api<{ pages: { pageNo: number; text: string }[] }>(`/api/books/${bookId}/pages?from=${p}&to=${Math.min(book.pageCount, p + 30)}`, "GET");
          pages.push(...d.pages);
        }
      }
      if (!pages.length) return setMsg("This book has no saved page text to read.");
      const starts = chapters.length ? chapters.map((c) => ({ number: c.number, title: c.title, startPage: c.startPage })) : undefined;
      const parsed = parseBook(pages, starts);
      setMsg("Saving questions…");
      const r = await api<{ items: number }>(`/api/books/${bookId}/structure`, "PUT", {
        keepExisting: true,
        chapters: structurePayload(parsed, (n) => chapters.find((x) => x.number === n)?.isAlp),
      });
      await refresh();
      flash(`Re-read complete ✔ ${r.items} questions.`);
    } catch (e) {
      setMsg(`Re-read failed: ${(e as Error).message}`);
    }
  }

  /**
   * Answer key for an exercise's MCQs, typed once: "b c a d", "bcad" or "1b 2c 3a" (in question order).
   * Every paper made from this book then gets the correct options automatically.
   */
  async function saveAnswerKey(mcqs: BookItemDTO[]) {
    const cur = mcqs.map((m) => (m.correctOption == null ? "-" : "abcde"[m.correctOption])).join(" ");
    const input = prompt(`Answer key for ${mcqs.length} MCQs, in order (e.g. b c a d …). Use - to skip one.\n\n${mcqs.map((m, i) => `${i + 1}. ${m.text.slice(0, 60)}`).join("\n").slice(0, 1500)}`, cur);
    if (input === null) return;
    const clean = input.toLowerCase().replace(/\d+\s*[.):-]?\s*/g, " ");
    const letters = (/^[a-e\-]+$/.test(clean.replace(/\s+/g, "")) && !/\s/.test(clean.trim()) ? clean.trim().split("") : clean.split(/[\s,;]+/)).filter(Boolean);
    const answers = mcqs.map((m, i) => {
      const l = letters[i];
      const idx = l ? "abcde".indexOf(l.replace(/[()]/g, "")) : -1;
      return { itemId: m.id, correctOption: idx >= 0 && idx < (m.options?.length ?? 4) ? idx : null };
    });
    await api(`/api/books/${bookId}/items`, "PUT", { answers });
    await loadItems();
    flash(`Answer key saved ✔ ${answers.filter((a) => a.correctOption != null).length}/${mcqs.length} MCQs`);
  }

  /** Smart Syllabus (ALP): mark chapters by number in one go, e.g. "1, 2, 4-6". */
  async function setSmartSyllabus() {
    const cur = chapters.filter((c) => c.isAlp).map((c) => c.number).join(", ");
    const input = prompt("Smart Syllabus / ALP chapter numbers for this book (e.g. 1, 2, 4-6). Leave empty to clear.", cur);
    if (input === null) return;
    const want = new Set(parseNumberList(input, 999));
    for (const c of chapters) if (!!c.isAlp !== want.has(c.number)) await api(`/api/books/${bookId}`, "PATCH", { chapter: { id: c.id, isAlp: want.has(c.number) } });
    await loadBook();
    flash(want.size ? `Smart Syllabus set: chapters ${[...want].join(", ")} ✔` : "Smart Syllabus cleared");
  }

  if (!book) return <p className="muted">{msg || "Loading…"}</p>;

  return (
    <div>
      <div className="card row">
        <div>
          <h1 style={{ margin: 0 }}>{book.title}</h1>
          <div className="small muted">{book.className} · {book.subjectName} · {book.board} {book.edition} · {book.pageCount} pages {book.shared && <span className="badge">Shared library</span>}</div>
        </div>
        <span className="spacer" />
        <a className="btn btn-ghost" href="/dashboard/library">← Library</a>
        {book.canEdit && <button className="btn-ghost" title="Mark which chapters are in the Smart Syllabus" onClick={setSmartSyllabus}>📋 Smart Syllabus chapters</button>}
        {book.canEdit && <button className="btn-ghost" title="Re-read questions with the improved reader" onClick={() => reRead()}>♻️ Re-read questions</button>}
        {book.canEdit && (
          <label className="btn btn-ghost" style={{ margin: 0 }} title="Scanned or Urdu (InPage) book? Choose the same PDF again: pages without readable text are read with free OCR (English + Urdu). Question IDs used in papers are kept.">
            📘 Re-read from PDF (OCR)
            <input type="file" hidden accept="application/pdf" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f && confirm(`Read "${f.name}" again (with OCR for scanned / Urdu pages) and re-read this book's questions?`)) reRead(f); }} />
          </label>
        )}
        {book.canEdit && <button className="btn-danger" onClick={async () => { if (confirm("Delete this book, its pages and all its questions?")) { await api(`/api/books/${bookId}`, "DELETE"); router.push("/dashboard/library"); } }}>Delete book</button>}
      </div>
      {msg && <div className="alert">{msg}</div>}

      <div className="sidebar-layout" style={{ marginTop: 14 }}>
        <div className="card">
          <h3>Chapters</h3>
          <ul className="list-plain">
            {chapters.map((c) => (
              <li key={c.id} className={`tree-item ${c.id === chId ? "active" : ""}`} onClick={() => { setChId(c.id); setEditing(null); }}>
                {c.number}. {c.title} {c.isAlp && <span className="badge ok">ALP</span>}
                <div className="small muted">p{c.startPage}–{c.endPage} · {c._count.items} Qs · {c.exercises.length} ex.</div>
              </li>
            ))}
          </ul>
          <div className="small muted" style={{ marginTop: 10 }}>Search the whole book:</div>
          <button className="btn-ghost btn-sm" onClick={() => setTab("search")}>🔍 Search book text</button>
        </div>

        <div className="card" style={{ marginTop: 0 }}>
          {ch && (
            <>
              <div className="row">
                <h2 style={{ margin: 0 }}>Ch {ch.number}: {ch.title}</h2>
                {book.canEdit && (
                  <button className={`btn-sm ${ch.isAlp ? "" : "btn-ghost"}`} title="Mark as Smart Syllabus / ALP chapter" onClick={async () => { await api(`/api/books/${bookId}`, "PATCH", { chapter: { id: ch.id, isAlp: !ch.isAlp } }); loadBook(); }}>
                    {ch.isAlp ? "✓ Smart Syllabus (ALP)" : "Mark as Smart Syllabus (ALP)"}
                  </button>
                )}
                {book.canEdit && <button className="btn-ghost btn-sm" onClick={async () => { const t = prompt("Chapter title", ch.title); if (t) { await api(`/api/books/${bookId}`, "PATCH", { chapter: { id: ch.id, title: t } }); loadBook(); } }}>Rename</button>}
              </div>
              {ch.topics && ch.topics.length > 0 && <div className="small muted" style={{ margin: "6px 0" }}>Topics: {ch.topics.join(" · ")}</div>}
            </>
          )}
          <div className="tabs">
            <button className={tab === "questions" ? "active" : ""} onClick={() => setTab("questions")}>Questions ({items.length})</button>
            <button className={tab === "pages" ? "active" : ""} onClick={() => setTab("pages")}>📄 Pages & topics</button>
            {book.canEdit && <button className={tab === "generate" ? "active" : ""} onClick={() => setTab("generate")}>✨ Auto-generate</button>}
            <button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}>🔍 Search</button>
          </div>

          {tab === "questions" && ch && (
            <div>
              {[...ch.exercises.map((e) => ({ key: e.id, title: `${e.title} (p${e.startPage}–${e.endPage})`, list: items.filter((i) => i.exerciseId === e.id) })),
                { key: "manual", title: "Added by teachers", list: items.filter((i) => !i.exerciseId && i.source === "MANUAL") },
                { key: "gen", title: "Auto-generated from chapter text", list: items.filter((i) => !i.exerciseId && i.source === "GENERATED") },
                { key: "other", title: "Other", list: items.filter((i) => !i.exerciseId && i.source === "EXERCISE") },
              ].filter((g) => g.list.length).map((g) => (
                <div key={g.key} style={{ marginBottom: 14 }}>
                  <div className="row"><b>{g.title}</b><span className="badge">{g.list.length}</span>
                    {(() => {
                      const mcqs = g.list.filter((x) => x.type === "MCQ");
                      const missing = mcqs.filter((x) => x.correctOption == null).length;
                      if (!mcqs.length) return null;
                      return (
                        <>
                          {missing > 0 ? <span className="badge warn">{missing} MCQ answer{missing > 1 ? "s" : ""} missing</span> : <span className="badge ok">answer key complete</span>}
                          {book.canEdit && <button className="btn-ghost btn-sm" onClick={() => saveAnswerKey(mcqs)}>🔑 Answer key</button>}
                        </>
                      );
                    })()}
                    {g.key === "gen" && book.canEdit && <button className="btn-danger btn-sm" onClick={async () => { await api(`/api/books/${bookId}/items?chapterId=${ch.id}&source=GENERATED`, "DELETE"); refresh(); }}>Clear generated</button>}
                  </div>
                  {g.list.map((it, idx) => (
                    <div className="qcard" key={it.id} style={{ marginTop: 6 }}>
                      {editing === it.id && draft ? (
                        <>
                          <QuestionForm compact value={draft} onChange={setDraft} />
                          <div className="row" style={{ marginTop: 6 }}>
                            <button className="btn-sm" onClick={async () => { await api(`/api/books/${bookId}/items`, "PATCH", { itemId: it.id, ...cleanDraft(draft) }); setEditing(null); loadItems(); }}>Save</button>
                            <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                          </div>
                        </>
                      ) : (
                        <div className="row" style={{ alignItems: "flex-start", flexWrap: "nowrap" }}>
                          <b style={{ minWidth: 46 }}>{idx + 1}. {it.qNo && it.qNo !== String(idx + 1) ? <span className="small muted">({it.qNo})</span> : null}</b>
                          <div style={{ flex: 1, fontFamily: "Times New Roman, serif" }}>
                            <span className="badge">{QTYPE_LABEL[it.type as QType]}</span> {it.pageNo && <span className="small muted">p{it.pageNo}</span>}
                            <MathText as="div" text={it.text} />
                            {it.options && <div className="small">{it.options.map((o, i) => <span key={i} style={{ marginRight: 10, fontWeight: it.correctOption === i ? 700 : 400 }}>({"abcde"[i]}) {o}</span>)}{it.correctOption == null && <span className="badge warn">set correct option</span>}</div>}
                            {it.answer && <div className="small muted">Ans: {it.answer}</div>}
                          </div>
                          {book.canEdit && (
                            <>
                              <button className="btn-ghost btn-sm" onClick={() => { setEditing(it.id); setDraft({ ...it }); }}>Edit</button>
                              <button className="btn-danger btn-sm" onClick={async () => { await api(`/api/books/${bookId}/items?itemId=${it.id}`, "DELETE"); refresh(); }}>✕</button>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ))}
              {!items.length && <p className="muted">No questions in this chapter yet. Use “Pages & topics” to pick questions from the page text, or “Auto-generate”.</p>}
            </div>
          )}

          {tab === "pages" && ch && <PageBrowser bookId={bookId} chapter={ch} canEdit={book.canEdit} onAdd={addItems} />}
          {tab === "generate" && ch && <Generator bookId={bookId} chapter={ch} onAdd={(l, ex) => addItems(l, "GENERATED", null, ex)} />}
          {tab === "search" && <BookSearch bookId={bookId} chapters={chapters} onOpen={(cid) => { setChId(cid); setTab("pages"); }} />}
        </div>
      </div>
    </div>
  );
}

/* ---------------- page text browser: select lines → questions ---------------- */
function PageBrowser({ bookId, chapter, canEdit, onAdd }: { bookId: string; chapter: BookChapterDTO; canEdit: boolean; onAdd: (l: DraftQuestion[], s: "MANUAL", ex?: string | null, extra?: Partial<ParsedItem>[]) => Promise<boolean> }) {
  const [pageNo, setPageNo] = useState(chapter.startPage);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [exerciseId, setExerciseId] = useState<string>("");
  const [manual, setManual] = useState<DraftQuestion | null>(null);
  useEffect(() => setPageNo(chapter.startPage), [chapter.id, chapter.startPage]);
  useEffect(() => {
    cachedGet<{ pages: { pageNo: number; text: string }[] }>(`/api/books/${bookId}/pages?from=${pageNo}&to=${pageNo}`).then((d) => { setText(d.pages[0]?.text ?? ""); setPicked(new Set()); });
  }, [bookId, pageNo]);
  const ls = text.split(/\n+/).filter(Boolean);
  const sel = () => [...picked].sort((a, b) => a - b).map((i) => ls[i]);

  async function convert(type: QType | "AUTO") {
    const t = sel();
    if (!t.length) return;
    const drafts: DraftQuestion[] = type === "AUTO" ? detectQuestions(t) : [{ ...emptyDraft(type), text: t.join(" ").replace(/^\s*\(?\d{1,3}[.)]\s*/, "") }];
    await onAdd(drafts, "MANUAL", exerciseId || null, drafts.map(() => ({ pageNo })));
    setPicked(new Set());
  }

  return (
    <div>
      <div className="row">
        <button className="btn-ghost btn-sm" disabled={pageNo <= chapter.startPage} onClick={() => setPageNo((p) => p - 1)}>◀</button>
        <span>PDF page <b>{pageNo}</b> <span className="small muted">(chapter: {chapter.startPage}–{chapter.endPage})</span></span>
        <button className="btn-ghost btn-sm" disabled={pageNo >= chapter.endPage} onClick={() => setPageNo((p) => p + 1)}>▶</button>
        <span className="spacer" />
        {canEdit && <button className="btn-ghost btn-sm" onClick={() => setManual(emptyDraft("SHORT"))}>+ Type a question for this chapter</button>}
      </div>
      {manual && (
        <div className="qcard" style={{ marginTop: 8 }}>
          <QuestionForm compact value={manual} onChange={setManual} />
          <div className="row" style={{ marginTop: 6 }}>
            <button className="btn-sm" onClick={async () => { await onAdd([manual], "MANUAL", exerciseId || null, [{ pageNo }]); setManual(null); }}>Add</button>
            <button className="btn-ghost btn-sm" onClick={() => setManual(null)}>Cancel</button>
          </div>
        </div>
      )}
      <div style={{ maxHeight: 420, overflow: "auto", border: "1px solid var(--line)", borderRadius: 8, padding: 8, marginTop: 8, fontSize: 13 }} dir="auto">
        {ls.map((l, i) => (
          <label key={i} className="check" style={{ alignItems: "flex-start", padding: "2px 0" }}>
            {canEdit && <input type="checkbox" checked={picked.has(i)} onChange={() => setPicked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; })} />}
            <span>{l}</span>
          </label>
        ))}
        {!ls.length && <span className="muted">This page has no text (scanned/InPage). Type the question manually.</span>}
      </div>
      {canEdit && (
        <div className="row" style={{ marginTop: 8, gap: 6 }}>
          <select style={{ width: 220 }} value={exerciseId} onChange={(e) => setExerciseId(e.target.value)}>
            <option value="">Add to: chapter (no exercise)</option>
            {chapter.exercises.map((e) => <option key={e.id} value={e.id}>Add to: {e.title}</option>)}
          </select>
          <span className="small muted">Selected lines →</span>
          <button className="btn-sm" disabled={!picked.size} onClick={() => convert("AUTO")}>✨ Auto-split</button>
          {(["MCQ", "FILL_BLANK", "TRUE_FALSE", "SHORT", "LONG", "CASE_STUDY"] as QType[]).map((t) => (
            <button key={t} className="btn-ghost btn-sm" disabled={!picked.size} onClick={() => convert(t)}>{QTYPE_LABEL[t].split(" (")[0]}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------- free auto-generation from definitions ---------------- */
function Generator({ bookId, chapter, onAdd }: { bookId: string; chapter: BookChapterDTO; onAdd: (l: DraftQuestion[], extra: Partial<ParsedItem>[]) => Promise<boolean> }) {
  const [list, setList] = useState<ParsedItem[] | null>(null);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const pages: { pageNo: number; text: string }[] = [];
      for (let p = chapter.startPage; p <= chapter.endPage; p += 31) {
        const d = await cachedGet<{ pages: { pageNo: number; text: string }[] }>(`/api/books/${bookId}/pages?from=${p}&to=${Math.min(chapter.endPage, p + 30)}`);
        pages.push(...d.pages);
      }
      const g = generateFromText(pages, chapter, 45);
      setList(g);
      setKeep(new Set(g.map((x) => x.tempId)));
    } catch {
      setList([]);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div>
      <p className="small muted">Finds definition sentences in this chapter (“X is …”, “X are called …”) and turns them into <b>Define</b>, <b>Fill in the blank</b> and <b>True/False</b> questions with answers. Free, no AI service. Review before saving.</p>
      <button disabled={busy} onClick={run}>{busy ? "Reading chapter…" : "✨ Generate from chapter text"}</button>
      {list && (
        <div style={{ marginTop: 10 }}>
          {!list.length && <p className="muted">No definition sentences found in this chapter (English “X is a / X refers to …”, Urdu “… سے مراد … ہے”, “… کو … کہتے ہیں”). If the pages have no text, use 📘 Re-read from PDF (OCR).</p>}
          {list.map((g) => (
            <label key={g.tempId} className="check qcard" style={{ alignItems: "flex-start" }}>
              <input type="checkbox" checked={keep.has(g.tempId)} onChange={() => setKeep((s) => { const n = new Set(s); n.has(g.tempId) ? n.delete(g.tempId) : n.add(g.tempId); return n; })} />
              <span><span className="badge">{QTYPE_LABEL[g.type]}</span> {g.text} <span className="small muted">→ {g.answer}</span></span>
            </label>
          ))}
          {list.length > 0 && (
            <button style={{ marginTop: 8 }} onClick={async () => {
              const chosen = list.filter((g) => keep.has(g.tempId));
              if (await onAdd(chosen.map((g) => ({ ...emptyDraft(g.type), text: g.text, answer: g.answer })), chosen)) setList(null);
            }}>Save {keep.size} questions</button>
          )}
        </div>
      )}
    </div>
  );
}

/* ---------------- whole-book search ---------------- */
function BookSearch({ bookId, chapters, onOpen }: { bookId: string; chapters: BookChapterDTO[]; onOpen: (chapterId: string) => void }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<{ pageNo: number; chapterId: string | null; line: string }[] | null>(null);
  return (
    <div>
      <form className="row" onSubmit={async (e) => { e.preventDefault(); if (q.trim().length < 2) return; const d = await api<{ hits: typeof hits }>(`/api/books/${bookId}/pages?q=${encodeURIComponent(q)}`, "GET"); setHits(d.hits); }}>
        <input style={{ flex: 1 }} placeholder="Word or topic, e.g. photosynthesis, Newton, اسلام" value={q} onChange={(e) => setQ(e.target.value)} />
        <button>Search</button>
      </form>
      {hits && (
        <div style={{ marginTop: 10 }}>
          {!hits.length && <p className="muted">Not found.</p>}
          {hits.map((h, i) => {
            const c = chapters.find((x) => x.id === h.chapterId);
            return (
              <div key={i} className="qcard small">
                <b>p{h.pageNo}</b> {c && <a href="#" onClick={(e) => { e.preventDefault(); onOpen(c.id); }}>Ch {c.number}: {c.title}</a>}
                <div dir="auto">{h.line}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
