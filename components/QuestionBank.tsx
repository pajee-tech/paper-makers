"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import QuestionForm, { cleanDraft, emptyDraft, type DraftQuestion } from "./QuestionForm";
import PdfBookPaperExtractor, { detectQuestions } from "./PdfBookPaperExtractor";
import MathText from "./MathText";
import { SvgIcon } from "./SvgIcons";
import { api, useCatalog } from "./useCatalog";
import { cachedGet } from "@/lib/clientCache";
import { matchQuestionStart, parseNumberList } from "@/lib/bookParse";
import { FEATURES } from "@/lib/edition";
import { LEVEL_LABEL, QTYPE_LABEL, QTYPE_SHORT, type Level, type QType } from "@/lib/types";

interface BankQ extends DraftQuestion { id: string; chapterId: string }
/** "ALL" = every chapter of the subject (full book), "ALP" = Smart Syllabus chapters, otherwise one chapter id */
type View = "" | "ALL" | "ALP" | string;

const DEFAULT_MARKS: Partial<Record<QType, number>> = { MCQ: 1, FILL_BLANK: 1, TRUE_FALSE: 1, SHORT: 2, LONG: 5, NUMERICAL: 3 };
const ANS_LINE = /^\s*(?:ans(?:wer)?|key|جواب)\s*[:.\-–]?\s*\(?\s*([a-dA-D]|الف|ب|ج|د)\s*\)?\s*$/i;
const UR_LETTER: Record<string, number> = { "الف": 0, "ب": 1, "ج": 2, "د": 3 };

/**
 * Pasted / typed text → question drafts. One question per number ("1.", "Q2", "(iii)", "۳۔"); MCQ options as
 * (a) (b) (c) (d). The correct option is set only when the teacher marks it: "(b) Keyboard *" or a line "Ans: b".
 */
function draftsFromText(text: string): DraftQuestion[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const answers = new Map<number, number>(); // question index → correct option
  const keep: string[] = [];
  let qIndex = -1;
  for (const l of lines) {
    const a = l.match(ANS_LINE);
    if (a && qIndex >= 0) { answers.set(qIndex, UR_LETTER[a[1]] ?? "abcd".indexOf(a[1].toLowerCase())); continue; }
    if (matchQuestionStart(l) || qIndex < 0) qIndex++;
    keep.push(l);
  }
  return detectQuestions(keep, 1).map((d, i) => {
    let correct: number | null = answers.get(i) ?? null;
    const options = d.options?.map((o, j) => {
      if (/\s*[*✓✔]$/.test(o)) { correct = j; return o.replace(/\s*[*✓✔]+$/, ""); }
      return o;
    }) ?? null;
    const type = d.type;
    return { ...d, options, correctOption: type === "MCQ" ? correct : null, marks: DEFAULT_MARKS[type] ?? 1 };
  });
}

export default function QuestionBank() {
  const { classes, reload } = useCatalog();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [view, setView] = useState<View>("");
  const [tab, setTab] = useState<"easy" | "pdf" | "list">("list");
  const [draft, setDraft] = useState<DraftQuestion>(emptyDraft("MCQ"));
  const [paste, setPaste] = useState("");
  const [pasted, setPasted] = useState<DraftQuestion[] | null>(null);
  const [addChapterId, setAddChapterId] = useState("");
  const [questions, setQuestions] = useState<BankQ[]>([]);
  const [typeFilter, setTypeFilter] = useState<QType | "">("");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<{ id: string; draft: DraftQuestion } | null>(null);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState({ cls: "", level: "PRIMARY" as Level, subject: "", subjectUrdu: false, chapter: "" });

  const cls = classes.find((c) => c.id === classId);
  const sub = cls?.subjects.find((s) => s.id === subjectId);
  const viewChapters = useMemo(() => {
    if (!sub) return [];
    if (view === "ALL") return sub.chapters;
    if (view === "ALP") return sub.chapters.filter((c) => c.isAlp);
    return sub.chapters.filter((c) => c.id === view);
  }, [sub, view]);
  const singleChapter = sub?.chapters.find((c) => c.id === view);
  // where new questions go: the open chapter, else the one picked in the add form
  const targetChapterId = singleChapter?.id ?? addChapterId;

  const loadQuestions = useCallback(async () => {
    if (!viewChapters.length) return setQuestions([]);
    const d = await cachedGet<{ questions: BankQ[] }>(`/api/questions?full=1&take=500&chapterIds=${viewChapters.map((c) => c.id).join(",")}`);
    setQuestions(d.questions);
  }, [viewChapters]);
  useEffect(() => { loadQuestions(); }, [loadQuestions]);
  useEffect(() => { if (sub && !sub.chapters.some((c) => c.id === addChapterId)) setAddChapterId(sub.chapters[0]?.id ?? ""); }, [sub, addChapterId]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3500); };
  const shown = questions.filter((q) => (!typeFilter || q.type === typeFilter) && (!search.trim() || `${q.text} ${q.urduText ?? ""} ${(q.options ?? []).join(" ")}`.toLowerCase().includes(search.trim().toLowerCase())));
  const chapterName = (id: string) => { const c = sub?.chapters.find((x) => x.id === id); return c ? `Ch ${c.number}` : ""; };

  async function addCatalog(kind: "class" | "subject" | "chapter") {
    try {
      if (kind === "class" && newName.cls) await api("/api/catalog", "POST", { kind, name: newName.cls, level: newName.level });
      if (kind === "subject" && newName.subject && classId) await api("/api/catalog", "POST", { kind, classId, name: newName.subject, isUrdu: newName.subjectUrdu });
      if (kind === "chapter" && newName.chapter && subjectId) await api("/api/catalog", "POST", { kind, subjectId, title: newName.chapter });
      setNewName({ ...newName, cls: "", subject: "", chapter: "" });
      reload();
    } catch (e) { flash((e as Error).message); }
  }

  async function removeCatalog(kind: string, id: string) {
    if (!confirm(`Delete this ${kind} and everything inside it?`)) return;
    await api(`/api/catalog?kind=${kind}&id=${id}`, "DELETE");
    if (kind === "chapter") setView("");
    reload();
  }

  /** Same chapters (numbers, titles, Smart Syllabus marks) as the uploaded book of this class + subject. */
  async function copyChaptersFromBook() {
    if (!cls || !sub) return;
    try {
      const list = await api<{ books: { id: string; title: string; match: number; _count: { chapters: number } }[] }>(`/api/books?className=${encodeURIComponent(cls.name)}&subjectName=${encodeURIComponent(sub.name)}`, "GET");
      const book = list.books.find((b) => b.match >= 3 && b._count.chapters > 0) ?? list.books.find((b) => b.match >= 1 && b._count.chapters > 0);
      if (!book) return flash(`No book for ${cls.name} ${sub.name} in Book Library yet.`);
      if (!confirm(`Copy the chapters of “${book.title}” into Question Bank → ${sub.name}?\nChapters that already exist (same number) are kept.`)) return;
      const d = await api<{ chapters: { number: number; title: string; isAlp?: boolean }[] }>(`/api/books/${book.id}`, "GET");
      const have = new Set(sub.chapters.map((c) => c.number));
      let n = 0;
      for (const c of d.chapters) {
        if (have.has(c.number)) continue;
        const made = await api<{ id: string }>("/api/catalog", "POST", { kind: "chapter", subjectId: sub.id, title: c.title.slice(0, 160), number: c.number });
        if (c.isAlp && FEATURES.smartSyllabus) await api("/api/catalog", "PATCH", { kind: "chapter", id: made.id, isAlp: true });
        n++;
      }
      await reload();
      flash(n ? `${n} chapter(s) copied from “${book.title}” ✔` : "All chapters already exist.");
    } catch (e) { flash((e as Error).message); }
  }

  async function saveDrafts(drafts: DraftQuestion[], chapterId = targetChapterId) {
    if (!chapterId) throw new Error("Choose the chapter these questions belong to");
    await api("/api/questions", "POST", { chapterId, questions: drafts.map(cleanDraft) });
    await Promise.all([loadQuestions(), reload()]);
  }

  const chapterPicker = sub && !singleChapter && (
    <div style={{ maxWidth: 360 }}>
      <label>Save into chapter</label>
      <select value={addChapterId} onChange={(e) => setAddChapterId(e.target.value)}>
        {!sub.chapters.length && <option value="">— add a chapter first —</option>}
        {sub.chapters.map((c) => <option key={c.id} value={c.id}>Ch {c.number}: {c.title}</option>)}
      </select>
    </div>
  );

  return (
    <div className="sidebar-layout">
      {/* ---------- Catalog tree ---------- */}
      <div className="card">
        <h3>Classes</h3>
        <ul className="list-plain" style={{ maxHeight: 220, overflow: "auto" }}>
          {classes.map((c) => (
            <li key={c.id} className={`tree-item ${c.id === classId ? "active" : ""}`} onClick={() => { setClassId(c.id); setSubjectId(""); setView(""); }}>
              {c.name} <span className="small muted">· {LEVEL_LABEL[c.level].split(" ")[0]}</span>
            </li>
          ))}
        </ul>
        <div className="row" style={{ gap: 4, marginTop: 6, flexWrap: "nowrap" }}>
          <input placeholder="New class" value={newName.cls} onChange={(e) => setNewName({ ...newName, cls: e.target.value })} />
          <select style={{ width: 110 }} value={newName.level} onChange={(e) => setNewName({ ...newName, level: e.target.value as Level })}>
            {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => <option key={l} value={l}>{LEVEL_LABEL[l]}</option>)}
          </select>
          <button className="btn-sm" onClick={() => addCatalog("class")}>+</button>
        </div>

        {cls && (
          <>
            <h3 style={{ marginTop: 16 }}>Subjects — {cls.name}</h3>
            <ul className="list-plain">
              {cls.subjects.map((s) => (
                <li key={s.id} className={`tree-item ${s.id === subjectId ? "active" : ""}`} onClick={() => { setSubjectId(s.id); setView("ALL"); setTab("list"); }}>
                  {s.name} {s.isUrdu && <span className="badge">RTL</span>}
                </li>
              ))}
            </ul>
            <div className="row" style={{ gap: 4, marginTop: 6, flexWrap: "nowrap" }}>
              <input placeholder="New subject" value={newName.subject} onChange={(e) => setNewName({ ...newName, subject: e.target.value })} />
              <label className="check small" title="Urdu / RTL subject"><input type="checkbox" checked={newName.subjectUrdu} onChange={(e) => setNewName({ ...newName, subjectUrdu: e.target.checked })} />اردو</label>
              <button className="btn-sm" onClick={() => addCatalog("subject")}>+</button>
            </div>
            <button className="btn-danger btn-sm" style={{ marginTop: 6 }} onClick={() => removeCatalog("class", cls.id)}>Delete class</button>
          </>
        )}

        {sub && (
          <>
            <h3 style={{ marginTop: 16 }}>Chapters — {sub.name}</h3>
            <ul className="list-plain">
              <li className={`tree-item ${view === "ALL" ? "active" : ""}`} onClick={() => setView("ALL")}>
                <b>📚 Full book</b> <span className="small muted">(all {sub.chapters.length} chapters · {sub.chapters.reduce((a, c) => a + c._count.questions, 0)} Qs)</span>
              </li>
              {FEATURES.smartSyllabus && (
                <li className={`tree-item ${view === "ALP" ? "active" : ""}`} onClick={() => setView("ALP")}>
                  <b>📋 Smart Syllabus</b> <span className="small muted">({sub.chapters.filter((c) => c.isAlp).length} chapters · {sub.chapters.filter((c) => c.isAlp).reduce((a, c) => a + c._count.questions, 0)} Qs)</span>
                </li>
              )}
              {sub.chapters.map((ch) => (
                <li key={ch.id} className={`tree-item ${ch.id === view ? "active" : ""}`} onClick={() => setView(ch.id)}>
                  {ch.number}. {ch.title} <span className="small muted">({ch._count.questions})</span>{" "}
                  {FEATURES.smartSyllabus && (
                    <button
                      className={`btn-sm ${ch.isAlp ? "" : "btn-ghost"}`}
                      style={{ padding: "0 6px", fontSize: 10 }}
                      title="Smart Syllabus / ALP chapter"
                      onClick={async (e) => { e.stopPropagation(); await api("/api/catalog", "PATCH", { kind: "chapter", id: ch.id, isAlp: !ch.isAlp }); reload(); }}
                    >ALP{ch.isAlp ? " ✓" : ""}</button>
                  )}
                </li>
              ))}
            </ul>
            <div className="row" style={{ gap: 4, marginTop: 6, flexWrap: "nowrap" }}>
              <input placeholder="New chapter / unit" value={newName.chapter} onChange={(e) => setNewName({ ...newName, chapter: e.target.value })} />
              <button className="btn-sm" onClick={() => addCatalog("chapter")}>+</button>
            </div>
            <button className="btn-ghost btn-sm" style={{ marginTop: 6 }} title="Make the same chapters as the uploaded textbook of this class and subject" onClick={copyChaptersFromBook}>📘 Copy chapters from Book Library</button>
            {FEATURES.smartSyllabus && (
              <button className="btn-ghost btn-sm" style={{ marginTop: 6 }} title="Smart Syllabus / ALP chapters" onClick={async () => {
                const input = prompt("Smart Syllabus / ALP chapter numbers (e.g. 1, 2, 4-6). Leave empty to clear.", sub.chapters.filter((c) => c.isAlp).map((c) => c.number).join(", "));
                if (input === null) return;
                const want = new Set(parseNumberList(input, 999));
                for (const c of sub.chapters) if (!!c.isAlp !== want.has(c.number)) await api("/api/catalog", "PATCH", { kind: "chapter", id: c.id, isAlp: want.has(c.number) });
                reload();
              }}>📋 Smart Syllabus chapters</button>
            )}
            <div className="row" style={{ gap: 4, marginTop: 6 }}>
              <button className="btn-danger btn-sm" onClick={() => removeCatalog("subject", sub.id)}>Delete subject</button>
              {singleChapter && <button className="btn-danger btn-sm" onClick={() => removeCatalog("chapter", singleChapter.id)}>Delete chapter</button>}
            </div>
          </>
        )}
      </div>

      {/* ---------- Questions ---------- */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="tabs">
          <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>Questions ({questions.length})</button>
          <button className={tab === "easy" ? "active" : ""} onClick={() => setTab("easy")}>✍️ Add questions</button>
          <button className={tab === "pdf" ? "active" : ""} onClick={() => setTab("pdf")}>📘 From textbook PDF</button>
        </div>
        {msg && <div className="alert">{msg}</div>}
        {!sub && <div className="alert">Pick a class → subject on the left. Then open 📚 Full book{FEATURES.smartSyllabus ? ", 📋 Smart Syllabus" : ""} or one chapter.</div>}
        {sub && !sub.chapters.length && <div className="alert">This subject has no chapters yet. Type a chapter name on the left and press +, or press 📘 Copy chapters from Book Library.</div>}

        {tab === "list" && sub && (
          <div>
            <div className="row" style={{ marginBottom: 8 }}>
              <b>{view === "ALL" ? "📚 Full book" : view === "ALP" ? "📋 Smart Syllabus chapters" : singleChapter ? `Ch ${singleChapter.number}: ${singleChapter.title}` : ""}</b>
              <span className="spacer" />
              <select style={{ width: 170 }} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value as QType | "")}>
                <option value="">All types</option>
                {(Object.keys(QTYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
              </select>
              <input style={{ width: 200 }} placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
            {shown.map((q) => (
              <div className="qcard" key={q.id}>
                <div className="row">
                  <span className="badge">{QTYPE_LABEL[q.type as QType]}</span>
                  {!singleChapter && <span className="badge">{chapterName(q.chapterId)}</span>}
                  <span className="small muted">{q.marks} marks</span>
                  {q.type === "MCQ" && q.correctOption == null && <span className="badge warn">answer not set</span>}
                  <span className="spacer" />
                  <button className="btn-ghost btn-sm" onClick={() => setEditing(editing?.id === q.id ? null : { id: q.id, draft: { ...q } })}>✏️ Edit</button>
                  <button className="btn-danger btn-sm" onClick={async () => { if (!confirm("Delete this question?")) return; await api(`/api/questions/${q.id}`, "DELETE"); loadQuestions(); reload(); }}>Delete</button>
                </div>
                {editing?.id === q.id ? (
                  <div style={{ marginTop: 8 }}>
                    <QuestionForm value={editing.draft} onChange={(d) => setEditing({ id: q.id, draft: d })} />
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="btn-sm" onClick={async () => {
                        try {
                          const { id: _i, chapterId: _c, ...rest } = cleanDraft(editing.draft) as DraftQuestion & { id?: string; chapterId?: string };
                          await api(`/api/questions/${q.id}`, "PUT", rest);
                          setEditing(null);
                          await loadQuestions();
                          flash("Question updated ✔");
                        } catch (e) { flash((e as Error).message); }
                      }}>Save changes</button>
                      <button className="btn-ghost btn-sm" onClick={() => setEditing(null)}>Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div style={{ fontFamily: "Times New Roman, serif", marginTop: 4 }}>
                    <MathText as="div" text={q.text} />
                    {q.urduText && <div className="urdu" dir="rtl">{q.urduText}</div>}
                    {q.options && <div className="small">{q.options.map((o, i) => <span key={i} style={{ marginRight: 12, fontWeight: q.correctOption === i ? 700 : 400, color: q.correctOption === i ? "var(--ok)" : undefined }}>({"ABCDE"[i]}) {o}{q.correctOption === i ? " ✓" : ""}</span>)}</div>}
                    {q.matchPairs && <div className="small">{q.matchPairs.map((p) => `${p.left} ↔ ${p.right}`).join(" · ")}</div>}
                    {q.icon && <SvgIcon name={q.icon} size={10} />}
                    {q.imageSnippet && <img src={q.imageSnippet} alt="" style={{ maxHeight: 90, display: "block" }} />}
                  </div>
                )}
              </div>
            ))}
            {!shown.length && sub.chapters.length > 0 && (
              <p className="muted">No questions here yet. Open <b>✍️ Add questions</b> to type or paste them.</p>
            )}
          </div>
        )}

        {tab === "easy" && sub && (
          <div>
            {chapterPicker}
            {singleChapter && <p className="small muted">Saving into <b>Ch {singleChapter.number}: {singleChapter.title}</b>.</p>}

            <h3 style={{ marginTop: 12 }}>1. Paste many questions at once (fastest)</h3>
            <p className="small muted" style={{ marginTop: 0 }}>
              Copy from Word / WhatsApp / a PDF, or type. One number per question (<code>1.</code> <code>Q2</code> <code>(iii)</code> <code>۳۔</code>), MCQ options as <code>(a) (b) (c) (d)</code>.
              Mark the right option with <code>*</code> — <code>(b) Keyboard *</code> — or a line <code>Ans: b</code>.
            </p>
            <textarea rows={8} placeholder={"1. Which device is used to input data?\n(a) Monitor (b) Keyboard * (c) Printer (d) Speaker\n2. Define hardware.\n3. Explain the types of computers."} value={paste} onChange={(e) => { setPaste(e.target.value); setPasted(null); }} />
            <div className="row" style={{ marginTop: 6 }}>
              <button className="btn-ghost" disabled={!paste.trim()} onClick={() => setPasted(draftsFromText(paste))}>👀 Check questions</button>
              {pasted && <span className="small">{pasted.length} found · {pasted.filter((d) => d.type === "MCQ").length} MCQ · {pasted.filter((d) => d.type === "MCQ" && d.correctOption == null).length} MCQ without answer</span>}
            </div>
            {pasted && pasted.map((d, i) => (
              <div key={i} className="qcard" style={{ marginTop: 6 }}>
                <div className="row"><b>{i + 1}.</b> <span className="badge">{QTYPE_SHORT[d.type]}</span> <span className="spacer" /><button className="btn-danger btn-sm" onClick={() => setPasted(pasted.filter((_, j) => j !== i))}>✕</button></div>
                <QuestionForm compact value={d} onChange={(nd) => setPasted(pasted.map((x, j) => (j === i ? nd : x)))} />
              </div>
            ))}
            {pasted && pasted.length > 0 && (
              <button style={{ marginTop: 8 }} disabled={!targetChapterId} onClick={async () => {
                try { await saveDrafts(pasted); setPaste(""); setPasted(null); flash(`${pasted.length} question(s) saved ✔`); setTab("list"); } catch (e) { flash((e as Error).message); }
              }}>💾 Save {pasted.length} questions</button>
            )}

            <h3 style={{ marginTop: 20 }}>2. Or add one question</h3>
            <QuestionForm value={draft} onChange={setDraft} />
            <button
              style={{ marginTop: 12 }}
              disabled={!targetChapterId || (!draft.text && !draft.imageSnippet && !draft.urduText && !draft.matchPairs?.length)}
              onClick={async () => {
                try {
                  await saveDrafts([draft]);
                  setDraft({ ...emptyDraft(draft.type), marks: draft.marks });
                  flash("Question saved ✔");
                } catch (e) { flash((e as Error).message); }
              }}
            >
              Save question
            </button>
          </div>
        )}

        {tab === "pdf" && sub && (
          <div>
            {chapterPicker}
            <PdfBookPaperExtractor disabled={!targetChapterId} onSave={(d) => saveDrafts(d)} />
          </div>
        )}
      </div>
    </div>
  );
}
