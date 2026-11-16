"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionForm, { cleanDraft, emptyDraft, type DraftQuestion } from "./QuestionForm";
import MathText from "./MathText";
import { api, useCatalog } from "./useCatalog";
import { TEMPLATES, TEMPLATE_GROUPS, paperTotal, sectionMarks } from "@/lib/templates";
import { parseNumberList } from "@/lib/bookParse";
import { findSubjectTemplate } from "@/lib/subjectTemplates";
import { allowedInSection, normalizeForSection } from "@/lib/questionRules";
import { scaleSection, scopeChapters, scopeFactor, SCOPE_LABEL, SCOPE_TITLE, type MarksMode, type Scope } from "@/lib/scope";
import type { BookChapterDTO } from "./BookViewer";
import UpgradePrompt from "./UpgradePrompt";
import { cachedGet, invalidateCache } from "@/lib/clientCache";
import { LEVEL_LABEL, PAPER_TYPE_LABEL, QTYPE_LABEL, QTYPE_SHORT, type Level, type PaperSection, type PaperTypeT, type PrintSettings, type QType, type QuestionSnapshot } from "@/lib/types";

type BankQ = DraftQuestion & { id: string; chapterId: string; exerciseId?: string | null; qNo?: string | null; pageNo?: number | null; fromBook?: boolean };
interface BookOpt { id: string; title: string; className: string; subjectName: string; board: string | null; match: number; shared: boolean; _count: { chapters: number; items: number } }
type BSection = PaperSection & { count: number; base?: { count: number; attemptAny: number | null } };

export interface BuilderInitial {
  id: string;
  title: string;
  paperType: PaperTypeT;
  examDate?: string | null;
  timeAllowed?: string | null;
  classId?: string | null;
  subjectId?: string | null;
  sections: PaperSection[];
  printSettings?: PrintSettings | null;
  buildOptions?: BuildOptions | null;
}

/** Builder choices saved with the paper so Edit reopens exactly as it was built. */
export interface BuildOptions {
  scope?: Scope; alpOnly?: boolean; marksMode?: MarksMode; useBank?: boolean; useBook?: boolean; withGenerated?: boolean;
  bookId?: string; bookChapterIds?: string[]; chapterIds?: string[];
}

const rid = () => Math.random().toString(36).slice(2, 10);
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

function toSnapshot(q: DraftQuestion & { id?: string }, marks: number, sectionType?: QType): QuestionSnapshot {
  const c = cleanDraft(sectionType ? normalizeForSection(q, sectionType) : q);
  return {
    id: q.id ?? `custom-${rid()}`,
    type: c.type, text: c.text, urduText: c.urduText, options: c.options, correctOption: c.correctOption, answer: c.answer,
    matchPairs: c.matchPairs, imageSnippet: c.imageSnippet, icon: c.icon, needsLines: !!c.needsLines, lineStyle: c.lineStyle ?? null,
    lineCount: c.lineCount ?? 2, marks,
  };
}

export default function PaperBuilder({ initial }: { initial?: BuilderInitial }) {
  const router = useRouter();
  const { classes, reload } = useCatalog();
  const [meta, setMeta] = useState({
    title: initial?.title ?? "",
    paperType: (initial?.paperType ?? "MONTHLY") as PaperTypeT,
    examDate: initial?.examDate?.slice(0, 10) ?? "",
    timeAllowed: initial?.timeAllowed ?? "",
    classId: initial?.classId ?? "",
    subjectId: initial?.subjectId ?? "",
  });
  const bo = initial?.buildOptions ?? null;
  const [chapterIds, setChapterIds] = useState<string[]>(bo?.chapterIds ?? []);
  const [sections, setSections] = useState<BSection[]>(() => (initial?.sections ?? []).map((s) => ({ ...s, count: s.questions.length })));
  const [bank, setBank] = useState<BankQ[]>([]);
  // --- textbook library source ---
  const [useBank, setUseBank] = useState(bo?.useBank ?? true);
  const [useBook, setUseBook] = useState(bo?.useBook ?? false);
  const [books, setBooks] = useState<BookOpt[]>([]);
  const [showAllBooks, setShowAllBooks] = useState(false);
  const [bookErr, setBookErr] = useState("");
  const [bookId, setBookId] = useState(bo?.bookId ?? "");
  const [outline, setOutline] = useState<BookChapterDTO[]>([]);
  const [bookChapterIds, setBookChapterIds] = useState<string[]>(bo?.bookChapterIds ?? []);
  const [withGenerated, setWithGenerated] = useState(bo?.withGenerated ?? true);
  const [bookItems, setBookItems] = useState<BankQ[]>([]);
  const [byNo, setByNo] = useState<{ sec: number; exerciseId: string; numbers: string } | null>(null);
  // --- test scope ---
  // Old papers (saved before build options existed) open as Custom so their chapters are not changed.
  const [scope, setScope] = useState<Scope>(bo?.scope ?? (initial ? "CUSTOM" : "FULL"));
  const [alpOnly, setAlpOnly] = useState(bo?.alpOnly ?? false);
  const [marksMode, setMarksMode] = useState<MarksMode>(bo?.marksMode ?? "FULL");
  const keepBookChapters = useRef(!!bo?.bookId); // first outline load on Edit keeps the saved chapter ticks
  const [loadingPool, setLoadingPool] = useState(0); // >0 while questions are being fetched
  const [autoPick, setAutoPick] = useState(false); // Smart Syllabus ticked → pick questions once the pool has loaded
  const [editQ, setEditQ] = useState<{ sec: number; qi: number; draft: DraftQuestion } | null>(null);
  const [presetNote, setPresetNote] = useState("");
  const autoTitle = useRef("");
  const [custom, setCustom] = useState<{ sec: number; draft: DraftQuestion } | null>(null);
  const [err, setErr] = useState("");
  const [upgrade, setUpgrade] = useState("");
  const [refreshKey, setRefreshKey] = useState(0); // bump to bypass the 24h browser cache
  const [saving, setSaving] = useState(false);

  const cls = classes.find((c) => c.id === meta.classId);
  const sub = cls?.subjects.find((s) => s.id === meta.subjectId);
  const total = paperTotal(sections);
  const all = useMemo(() => [...(useBank ? bank : []), ...(useBook ? bookItems : [])], [useBank, bank, useBook, bookItems]);
  const used = useMemo(() => new Set(sections.flatMap((s) => s.questions.map((q) => q.id))), [sections]);
  const templates = useMemo(() => (cls ? [...TEMPLATES].sort((a, b) => Number(b.level.includes(cls.level)) - Number(a.level.includes(cls.level))) : TEMPLATES), [cls]);

  // Load bank questions for the selected chapters (or all chapters of the subject).
  useEffect(() => {
    const ids = chapterIds.length ? chapterIds : sub?.chapters.map((c) => c.id) ?? [];
    if (!ids.length) return setBank([]);
    setLoadingPool((n) => n + 1);
    cachedGet<{ questions: BankQ[] }>(`/api/questions?take=500&chapterIds=${ids.join(",")}`).then((d) => setBank(d.questions)).catch(() => setBank([])).finally(() => setLoadingPool((n) => n - 1));
  }, [chapterIds, sub, refreshKey]);

  // Books for this class + subject (shared platform library + own).
  useEffect(() => {
    if (!cls) return;
    cachedGet<{ books: BookOpt[] }>(`/api/books?className=${encodeURIComponent(cls.name)}&subjectName=${encodeURIComponent(sub?.name ?? "")}`)
      .then((d) => {
        setBookErr("");
        setBooks(d.books);
        const best = d.books.find((b) => b.match === 3);
        if (best && !bookId) { setBookId(best.id); setUseBook(true); }
      })
      .catch((e) => { setBooks([]); setBookErr((e as Error).message); });
  }, [cls, sub, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setOutline([]); setBookItems([]);
    if (keepBookChapters.current) keepBookChapters.current = false;
    else setBookChapterIds([]);
    if (!bookId) return;
    cachedGet<{ chapters: BookChapterDTO[] }>(`/api/books/${bookId}`).then((d) => setOutline(d.chapters)).catch(() => {});
  }, [bookId]);

  useEffect(() => {
    if (!bookId || !useBook) return setBookItems([]);
    const src = withGenerated ? "EXERCISE,MANUAL,GENERATED" : "EXERCISE,MANUAL";
    setLoadingPool((n) => n + 1);
    cachedGet<{ items: (DraftQuestion & { id: string; chapterId: string; exerciseId: string | null; qNo: string | null; pageNo: number | null })[] }>(
      `/api/books/${bookId}/items?source=${src}${bookChapterIds.length ? `&chapterIds=${bookChapterIds.join(",")}` : ""}`,
    ).then((d) => setBookItems(d.items.map((q) => ({ ...q, id: `book-${q.id}`, fromBook: true })))).catch(() => setBookItems([])).finally(() => setLoadingPool((n) => n - 1));
  }, [bookId, useBook, bookChapterIds, withGenerated, refreshKey]);

  // Scope → which chapters (question bank + textbook) feed this paper.
  const bankChapters = useMemo(() => (sub?.chapters ?? []).map((c) => ({ ...c, isAlp: !!c.isAlp })), [sub]);
  useEffect(() => {
    if (scope === "CUSTOM") return;
    const pickIds = <T extends { id: string; number: number; isAlp?: boolean }>(list: T[]) => {
      if (!list.length) return [];
      const chosen = scopeChapters(list, scope, alpOnly);
      // "none ticked" means whole subject, so an empty filtered scope uses a sentinel that matches nothing.
      if (!chosen.length) return ["__none__"];
      return chosen.length === list.length ? [] : chosen.map((c) => c.id);
    };
    setChapterIds(pickIds(bankChapters));
    setBookChapterIds(pickIds(outline));
  }, [scope, alpOnly, bankChapters, outline]);

  useEffect(() => {
    const t = SCOPE_TITLE[scope];
    if (t && (!meta.title || meta.title === autoTitle.current)) {
      autoTitle.current = t;
      setMeta((m) => ({ ...m, title: t }));
    }
  }, [scope]); // eslint-disable-line react-hooks/exhaustive-deps

  const scopeTotal = outline.length || bankChapters.length;
  const scopeSelected = (outline.length ? bookChapterIds : chapterIds).filter((x) => x !== "__none__").length || (scope === "CUSTOM" ? 0 : scopeTotal);
  const factor = marksMode === "SCALE" ? scopeFactor(scope, scopeSelected, scopeTotal) : 1;
  const firstFactor = useRef(true);
  useEffect(() => {
    // On Edit the saved sections are already scaled — only rescale when the teacher changes the scope later.
    if (firstFactor.current) { firstFactor.current = false; if (initial) return; }
    setSections((ss) => ss.map((sec) => {
      const scaled = scaleSection(sec, factor);
      return { ...scaled, questions: scaled.questions.slice(0, scaled.count) };
    }));
  }, [factor]);

  const fromTpl = (tpl: { count: number; attemptAny?: number | null }[] & object[]) =>
    (tpl as (Omit<BSection, "id" | "questions">)[]).map(({ count, ...sx }) => scaleSection({ ...sx, id: rid(), count, base: { count, attemptAny: sx.attemptAny ?? null }, questions: [] } as BSection, factor));

  /** Selecting a subject loads its BISE Punjab board preset (marks, time, sections). */
  function onSubjectChange(subjectId: string) {
    setMeta((m) => ({ ...m, subjectId }));
    setChapterIds([]);
    setBookId("");
    setPresetNote("");
    const sj = cls?.subjects.find((x) => x.id === subjectId);
    const preset = findSubjectTemplate(sj?.name, cls?.level);
    if (!preset) return;
    if (sections.some((x) => x.questions.length) && !confirm(`Load the BISE Punjab pattern for ${sj?.name}? Current sections will be replaced.`)) return;
    setSections(fromTpl(preset.sections));
    setMeta((m) => ({ ...m, subjectId, timeAllowed: preset.timeAllowed }));
    setPresetNote(`${preset.label} loaded — ${preset.totalMarks} marks.`);
  }

  async function addCatalog(kind: "class" | "subject") {
    const name = prompt(kind === "class" ? "New class name (e.g. O Level 1, Hifz Class)" : `New subject for ${cls?.name}`);
    if (!name?.trim()) return;
    try {
      if (kind === "class") {
        const level = (prompt("Level? Type one: EARLY_YEARS, PRIMARY, MIDDLE, MATRIC, INTERMEDIATE, GRADUATION", "MATRIC") ?? "MATRIC").toUpperCase() as Level;
        const c = await api<{ id: string }>("/api/catalog", "POST", { kind, name: name.trim(), level: level in LEVEL_LABEL ? level : "MATRIC" });
        await reload();
        setMeta((m) => ({ ...m, classId: c.id, subjectId: "" }));
      } else if (cls) {
        const sj = await api<{ id: string }>("/api/catalog", "POST", { kind, classId: cls.id, name: name.trim(), isUrdu: /urdu|اردو/i.test(name) });
        await reload();
        setMeta((m) => ({ ...m, subjectId: sj.id }));
      }
    } catch (e) { setErr((e as Error).message); }
  }

  function addByNumbers() {
    if (!byNo) return;
    const s = sections[byNo.sec];
    const inEx = bookItems.filter((q) => q.exerciseId === byNo.exerciseId);
    const wanted = parseNumberList(byNo.numbers, inEx.length);
    const picked = wanted.map((n) => inEx[n - 1]).filter((q) => q && !used.has(q.id) && allowedInSection(q as QuestionSnapshot, s.questionType));
    if (!picked.length) return alert(`No ${QTYPE_LABEL[s.questionType]} at those numbers. Only questions of this section's type can be added.`);
    updateSec(byNo.sec, { questions: [...s.questions, ...picked.map((q) => toSnapshot(q, s.marksEach, s.questionType))] });
    setByNo(null);
  }

  const updateSec = (i: number, patch: Partial<BSection>) => setSections((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  // Strict: an MCQ section only gets MCQs (with options), SHORT only short, LONG only long, etc.
  const pool = (type: QType) => all.filter((q) => allowedInSection(q as QuestionSnapshot, type) && !used.has(q.id));

  function applyTemplate(key: string) {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    if (sections.some((s) => s.questions.length) && !confirm("Replace current sections with this template?")) return;
    setSections(fromTpl(t.sections));
    if (!meta.timeAllowed) setMeta((m) => ({ ...m, timeAllowed: t.timeAllowed }));
  }

  // Smart Syllabus: chapters are filtered by the scope effect, the pool reloads, then questions are picked automatically.
  useEffect(() => {
    if (!autoPick || loadingPool > 0) return;
    const t = setTimeout(() => { autofill(); setAutoPick(false); }, 150);
    return () => clearTimeout(t);
  }, [autoPick, loadingPool, all]); // eslint-disable-line react-hooks/exhaustive-deps

  function autofill() {
    const taken = new Set<string>();
    setSections((ss) =>
      ss.map((s) => {
        const keep = s.questions.filter((q) => q.id.startsWith("custom-"));
        keep.forEach((q) => taken.add(q.id));
        // MCQs that already have a correct answer are picked first (so the answer key / OMR scoring is complete)
        const avail = shuffle(all.filter((q) => allowedInSection(q as QuestionSnapshot, s.questionType) && !taken.has(q.id)))
          .sort((a, b) => (s.questionType === "MCQ" ? Number(b.correctOption != null) - Number(a.correctOption != null) : 0));
        const pick = avail.slice(0, Math.max(0, s.count - keep.length));
        pick.forEach((q) => taken.add(q.id));
        return { ...s, questions: [...keep, ...pick.map((q) => toSnapshot(q, s.questionType === "MATCH_COLUMNS" ? q.marks ?? s.marksEach : s.marksEach, s.questionType))] };
      }),
    );
  }

  function swap(si: number, qi: number) {
    const s = sections[si];
    const p = pool(s.questionType);
    if (!p.length) return alert("No more unused questions of this type in the selected chapters.");
    const q = p[Math.floor(Math.random() * p.length)];
    updateSec(si, { questions: s.questions.map((x, j) => (j === qi ? toSnapshot(q, s.marksEach, s.questionType) : x)) });
  }

  function move(i: number, d: -1 | 1) {
    setSections((ss) => { const a = [...ss]; const j = i + d; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });
  }

  async function save() {
    setErr("");
    if (!meta.title.trim()) return setErr("Give the paper a title");
    if (!sections.length || sections.every((s) => !s.questions.length)) return setErr("Add at least one question");
    setSaving(true);
    const body = {
      ...meta,
      examDate: meta.examDate || null,
      classId: meta.classId || null,
      subjectId: meta.subjectId || null,
      sections: sections.filter((s) => s.questions.length).map(({ count: _c, base: _b, ...s }) => ({ ...s, questions: s.questions.filter((q) => allowedInSection(q, s.questionType)).map((q) => normalizeForSection(q, s.questionType)) })),
      printSettings: initial?.printSettings ?? null,
      buildOptions: { scope, alpOnly, marksMode, useBank, useBook, withGenerated, bookId: bookId || undefined, bookChapterIds, chapterIds },
    };
    try {
      if (initial) {
        await api(`/api/papers/${initial.id}`, "PUT", body);
        router.push(`/dashboard/papers/${initial.id}`);
      } else {
        const d = await api<{ id: string }>("/api/papers", "POST", body);
        router.push(`/dashboard/papers/${d.id}`);
      }
      router.refresh();
    } catch (e) {
      // 402 = trial quota or trial period exhausted → upgrade prompt instead of a plain error
      if ((e as { status?: number }).status === 402) { setUpgrade((e as Error).message); window.scrollTo({ top: 0, behavior: "smooth" }); }
      else setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div>
      {upgrade && <UpgradePrompt message={upgrade} />}
      {err && <div className="alert err">{err}</div>}

      {/* ---------- 1. Paper details ---------- */}
      <div className="card">
        <h2>1. Paper details</h2>
        <div className="grid3">
          <div className="field">
            <label>Class</label>
            <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
              <select value={meta.classId} onChange={(e) => { setMeta({ ...meta, classId: e.target.value, subjectId: "" }); setChapterIds([]); setBookId(""); }}>
                <option value="">— select class —</option>
                {(Object.keys(LEVEL_LABEL) as Level[]).map((l) => {
                  const list = classes.filter((c) => c.level === l);
                  return list.length ? <optgroup key={l} label={LEVEL_LABEL[l]}>{list.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</optgroup> : null;
                })}
              </select>
              <button type="button" className="btn-ghost btn-sm" title="Add your own class" onClick={() => addCatalog("class")}>+</button>
            </div>
          </div>
          <div className="field">
            <label>Subject</label>
            <div className="row" style={{ flexWrap: "nowrap", gap: 4 }}>
              <select value={meta.subjectId} disabled={!cls} onChange={(e) => onSubjectChange(e.target.value)}>
                <option value="">{cls ? `— ${cls.subjects.length} subjects —` : "select class first"}</option>
                {cls?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <button type="button" className="btn-ghost btn-sm" disabled={!cls} title="Add a subject your school teaches" onClick={() => addCatalog("subject")}>+</button>
            </div>
          </div>
          <div className="field">
            <label>Exam type</label>
            <select value={meta.paperType} onChange={(e) => setMeta({ ...meta, paperType: e.target.value as PaperTypeT })}>
              {(Object.keys(PAPER_TYPE_LABEL) as PaperTypeT[]).map((t) => <option key={t} value={t}>{PAPER_TYPE_LABEL[t]}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Paper title (printed)</label>
            <input value={meta.title} placeholder={`${PAPER_TYPE_LABEL[meta.paperType]} ${new Date().getFullYear()}`} onChange={(e) => setMeta({ ...meta, title: e.target.value })} />
          </div>
          <div className="field"><label>Date</label><input type="date" value={meta.examDate} onChange={(e) => setMeta({ ...meta, examDate: e.target.value })} /></div>
          <div className="field"><label>Time allowed</label><input value={meta.timeAllowed} placeholder="2:30 Hours" onChange={(e) => setMeta({ ...meta, timeAllowed: e.target.value })} /></div>
        </div>
        {presetNote && <div className="alert ok">📋 {presetNote} Counts and marks stay editable below.</div>}
        {sub && (
          <div className="qcard" style={{ background: "#f8fafc", marginBottom: 10 }}>
            <label>Test scope</label>
            <div className="row">
              <select style={{ width: 260 }} value={scope} onChange={(e) => { const v = e.target.value as Scope; setScope(v); setMarksMode(v.startsWith("Q") ? "SCALE" : "FULL"); }}>
                {(Object.keys(SCOPE_LABEL) as Scope[]).map((k) => <option key={k} value={k}>{SCOPE_LABEL[k]}</option>)}
              </select>
              <label className="check"><input type="checkbox" checked={alpOnly} onChange={(e) => { setAlpOnly(e.target.checked); if (e.target.checked && scope === "CUSTOM") setScope("FULL"); if (e.target.checked && sections.length) setAutoPick(true); }} /> Smart Syllabus / ALP only</label>
              {scope !== "FULL" && (
                <>
                  <label className="check"><input type="radio" name="marksMode" checked={marksMode === "FULL"} onChange={() => setMarksMode("FULL")} /> Keep full board-pattern marks</label>
                  <label className="check"><input type="radio" name="marksMode" checked={marksMode === "SCALE"} onChange={() => setMarksMode("SCALE")} /> Scale marks &amp; questions to scope (×{factor.toFixed(2)})</label>
                </>
              )}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>
              {scope === "CUSTOM" ? "Tick chapters yourself below." : `Chapters are picked automatically${alpOnly ? " from the Smart Syllabus (ALP) chapters" : ""}.`}
              {(chapterIds.includes("__none__") || bookChapterIds.includes("__none__")) && <span style={{ color: "var(--warn)" }}> No chapters match — mark Smart Syllabus chapters with the ALP button in Question Bank / Book Library.</span>}
            </div>
          </div>
        )}
        {sub && (
          <div className="qcard" style={{ background: "#f8fafc" }}>
            <label>Where should questions come from?</label>
            <div className="row">
              <label className="check"><input type="checkbox" checked={useBank} onChange={(e) => setUseBank(e.target.checked)} /> My question bank ({bank.length})</label>
              <label className="check"><input type="checkbox" checked={useBook} disabled={!books.length} onChange={(e) => setUseBook(e.target.checked)} /> 📘 From textbook / syllabus ({useBook ? bookItems.length : books.filter((b) => b.match >= 1).length ? "available" : "none yet"})</label>
              <span className="small muted">+ you can always type your own questions in any section.</span>
            </div>
            {bookErr && <div className="small" style={{ color: "var(--warn)" }}>{bookErr}</div>}
            {!books.length && !bookErr && <div className="small muted">No book for {cls?.name} {sub.name} in the library yet. <a href="/dashboard/library/upload">Add the book</a> once and every teacher can use it.</div>}
            {useBook && books.length > 0 && (
              <div style={{ marginTop: 8 }}>
                <div className="row">
                  <select style={{ maxWidth: 460 }} value={bookId} onChange={(e) => setBookId(e.target.value)}>
                    <option value="">— choose book —</option>
                    {books.filter((b) => showAllBooks || b.match >= 1).map((b) => <option key={b.id} value={b.id}>{b.title} · {b.className} · {b.subjectName}{b.board ? ` · ${b.board}` : ""} ({b._count.items} Qs){b.shared ? " · shared" : ""}</option>)}
                  </select>
                  <label className="check small"><input type="checkbox" checked={showAllBooks} onChange={(e) => setShowAllBooks(e.target.checked)} /> show all books</label>
                  <label className="check small"><input type="checkbox" checked={withGenerated} onChange={(e) => setWithGenerated(e.target.checked)} /> include auto-generated questions</label>
                </div>
                {outline.length > 0 && (
                  <>
                    <label style={{ marginTop: 8 }}>Book chapters for this paper (none ticked = whole book)</label>
                    <div className="row" style={{ gap: 10 }}>
                      {outline.map((c) => (
                        <label key={c.id} className="check">
                          <input type="checkbox" checked={bookChapterIds.includes(c.id)} onChange={(e) => { setScope("CUSTOM"); setBookChapterIds((ids) => (e.target.checked ? [...ids.filter((x) => x !== "__none__"), c.id] : ids.filter((x) => x !== c.id))); }} />
                          {c.number}. {c.title} {c.isAlp && <span className="badge ok">ALP</span>} <span className="muted small">({c._count.items})</span>
                        </label>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}
        {sub && sub.chapters.length > 0 && useBank && (
          <div style={{ marginTop: 10 }}>
            <label>Question bank chapters (none ticked = whole subject) · {bank.length} questions available</label>
            <div className="row" style={{ gap: 10 }}>
              {sub.chapters.map((ch) => (
                <label key={ch.id} className="check">
                  <input type="checkbox" checked={chapterIds.includes(ch.id)} onChange={(e) => { setScope("CUSTOM"); setChapterIds((ids) => (e.target.checked ? [...ids.filter((x) => x !== "__none__"), ch.id] : ids.filter((x) => x !== ch.id))); }} />
                  {ch.number}. {ch.title} {ch.isAlp && <span className="badge ok">ALP</span>} <span className="muted small">({ch._count.questions})</span>
                </label>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ---------- 2. Pattern ---------- */}
      <div className="card">
        <div className="row">
          <h2 style={{ margin: 0 }}>2. Paper pattern</h2>
          <span className="spacer" />
          <select style={{ width: 330 }} defaultValue="" onChange={(e) => { applyTemplate(e.target.value); e.target.value = ""; }}>
            <option value="">Load a template…</option>
            {TEMPLATE_GROUPS.map((g) => {
              const list = templates.filter((t) => t.group === g);
              return list.length ? <optgroup key={g} label={g}>{list.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}</optgroup> : null;
            })}
          </select>
          <button className="btn-ghost" onClick={() => setSections((ss) => [...ss, { id: rid(), title: `Q.${ss.length + 1}`, questionType: "SHORT", marksEach: 2, count: 5, questions: [] }])}>+ Section</button>
          <button className="btn-ghost" title="Questions are cached in this browser for 24 hours. Refresh to load the newest ones." onClick={async () => { await invalidateCache("q:"); await invalidateCache("book:"); await invalidateCache("cat:"); await reload(); setRefreshKey((k) => k + 1); }}>↻ Refresh questions</button>
          <button disabled={!all.length || !sections.length} onClick={autofill}>🎲 Auto-pick from bank</button>
        </div>
        <p className="small muted">Counts and marks are editable. “Attempt any” sets the choice rule — only that many questions count toward the total.</p>

        {sections.map((s, si) => {
          const avail = pool(s.questionType).length;
          return (
            <div key={s.id} className="qcard" style={{ marginTop: 12, borderLeft: "4px solid var(--brand)" }}>
              <div className="row top">
                <div style={{ flex: 3, minWidth: 220 }}><label>Heading</label><input value={s.title} onChange={(e) => updateSec(si, { title: e.target.value })} /></div>
                <div style={{ width: 190 }}>
                  <label>Question type</label>
                  <select value={s.questionType} onChange={(e) => updateSec(si, { questionType: e.target.value as QType, questions: [] })}>
                    {(Object.keys(QTYPE_LABEL) as QType[]).map((t) => <option key={t} value={t}>{QTYPE_LABEL[t]}</option>)}
                  </select>
                </div>
                <div style={{ width: 80 }}><label>Questions</label><input type="number" min={1} max={100} value={s.count} onChange={(e) => updateSec(si, { count: Number(e.target.value) })} /></div>
                <div style={{ width: 90 }}><label>Attempt any</label><input type="number" min={0} max={100} value={s.attemptAny ?? 0} onChange={(e) => updateSec(si, { attemptAny: Number(e.target.value) || null })} /></div>
                <div style={{ width: 80 }}><label>Marks each</label><input type="number" min={0} step={0.5} value={s.marksEach} onChange={(e) => updateSec(si, { marksEach: Number(e.target.value), questions: s.questions.map((q) => ({ ...q, marks: Number(e.target.value) })) })} /></div>
              </div>
              <div className="row" style={{ marginTop: 6 }}>
                <div style={{ flex: 1, minWidth: 220 }}><input placeholder="Instructions (optional)" value={s.instructions ?? ""} onChange={(e) => updateSec(si, { instructions: e.target.value })} /></div>
                <div style={{ width: 200 }}><input className="urdu" dir="rtl" placeholder="اردو ہدایات (اختیاری)" value={s.urduInstructions ?? ""} onChange={(e) => updateSec(si, { urduInstructions: e.target.value })} /></div>
                {s.questionType === "MCQ" && <label className="check"><input type="checkbox" checked={!!s.isObjective} onChange={(e) => updateSec(si, { isObjective: e.target.checked })} /> Objective (OMR)</label>}
                <label className="check"><input type="checkbox" checked={!!s.pageBreakBefore} onChange={(e) => updateSec(si, { pageBreakBefore: e.target.checked })} /> New page</label>
                <span className="badge">{sectionMarks(s)} marks</span>
                <button className="btn-ghost btn-sm" onClick={() => move(si, -1)}>↑</button>
                <button className="btn-ghost btn-sm" onClick={() => move(si, 1)}>↓</button>
                <button className="btn-danger btn-sm" onClick={() => setSections((ss) => ss.filter((_, j) => j !== si))}>✕</button>
              </div>

              <ol style={{ margin: "10px 0 0", paddingLeft: 22 }}>
                {s.questions.map((q, qi) => (
                  <li key={q.id + qi} style={{ marginBottom: 4 }}>
                    <div className="row" style={{ flexWrap: "nowrap", alignItems: "flex-start" }}>
                      <div style={{ flex: 1, fontFamily: "Times New Roman, serif" }}>
                        <MathText text={q.text || (q.imageSnippet ? "[image]" : q.urduText ?? "")} />
                        {q.id.startsWith("custom-") && <span className="badge" style={{ marginLeft: 6 }}>custom / edited</span>}
                        {q.type === "MCQ" && q.options && (
                          <div className="small muted">
                            {q.options.map((o, i) => <span key={i} style={{ marginRight: 10, fontWeight: q.correctOption === i ? 700 : 400, color: q.correctOption === i ? "var(--ok)" : undefined }}>({"abcde"[i]}) {o}{q.correctOption === i ? " ✓" : ""}</span>)}
                            {q.correctOption == null && <span className="badge warn">answer not set — click ✏️</span>}
                          </div>
                        )}
                      </div>
                      <button className="btn-ghost btn-sm" title="Edit this question (only in this paper)" onClick={() => setEditQ({ sec: si, qi, draft: { ...q, type: s.questionType } })}>✏️</button>
                      {!q.id.startsWith("custom-") && <button className="btn-ghost btn-sm" title="Swap with another question" onClick={() => swap(si, qi)}>⇄</button>}
                      <button className="btn-danger btn-sm" onClick={() => updateSec(si, { questions: s.questions.filter((_, j) => j !== qi) })}>✕</button>
                    </div>
                    {editQ?.sec === si && editQ.qi === qi && (
                      <div className="card" style={{ marginTop: 6 }}>
                        <div className="small muted" style={{ marginBottom: 6 }}>Changes apply to this paper only — the question bank / textbook stays unchanged.</div>
                        <QuestionForm compact lockType value={editQ.draft} onChange={(d) => setEditQ({ ...editQ, draft: { ...d, type: s.questionType } })} />
                        <div className="row" style={{ marginTop: 6 }}>
                          <button className="btn-sm" onClick={() => {
                            // An edited question becomes this paper's own copy ("custom-…"), so the original is never modified.
                            const { id: _old, ...rest } = editQ.draft as DraftQuestion & { id?: string };
                            updateSec(si, { questions: s.questions.map((x, j) => (j === qi ? toSnapshot({ ...rest, type: s.questionType }, x.marks || s.marksEach, s.questionType) : x)) });
                            setEditQ(null);
                          }}>Save change</button>
                          <button className="btn-ghost btn-sm" onClick={() => setEditQ(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
              <div className="row" style={{ marginTop: 6 }}>
                <span className={`small ${s.questions.length < s.count ? "" : "muted"}`} style={{ color: s.questions.length < s.count ? "var(--warn)" : undefined }}>
                  {s.questions.length}/{s.count} selected · {avail} unused in bank
                </span>
                <select style={{ width: 300 }} value="" onChange={(e) => { const q = all.find((x) => x.id === e.target.value); if (q) updateSec(si, { questions: [...s.questions, toSnapshot(q, s.marksEach, s.questionType)] }); }}>
                  <option value="">+ add a specific question from bank…</option>
                  {pool(s.questionType).map((q) => <option key={q.id} value={q.id}>{q.fromBook ? `📘 ${q.qNo ?? ""} ` : ""}{(q.text || "[image]").slice(0, 90)}</option>)}
                </select>
                <button className="btn-ghost btn-sm" onClick={() => setCustom({ sec: si, draft: { ...emptyDraft(s.questionType), marks: s.marksEach } })}>+ Write a custom question</button>
                {useBook && outline.some((c) => c.exercises.length) && (
                  <button className="btn-ghost btn-sm" onClick={() => setByNo({ sec: si, exerciseId: "", numbers: "" })}>📘 Add by exercise & question no.</button>
                )}
              </div>
              {byNo?.sec === si && (
                <div className="card" style={{ marginTop: 8 }}>
                  <div className="row">
                    <select style={{ maxWidth: 380 }} value={byNo.exerciseId} onChange={(e) => setByNo({ ...byNo, exerciseId: e.target.value })}>
                      <option value="">— chapter / exercise —</option>
                      {outline.filter((c) => !bookChapterIds.length || bookChapterIds.includes(c.id)).map((c) => (
                        <optgroup key={c.id} label={`Ch ${c.number}: ${c.title}`}>
                          {c.exercises.map((e) => <option key={e.id} value={e.id}>{e.title} ({e._count.items} Qs)</option>)}
                        </optgroup>
                      ))}
                    </select>
                    <input style={{ width: 170 }} placeholder="Q no. e.g. 1-5, 8" value={byNo.numbers} onChange={(e) => setByNo({ ...byNo, numbers: e.target.value })} />
                    <span className="small muted">Only {QTYPE_LABEL[s.questionType]} are added to this section.</span>
                    <button className="btn-sm" disabled={!byNo.exerciseId || !byNo.numbers.trim()} onClick={addByNumbers}>Add</button>
                    <button className="btn-ghost btn-sm" onClick={() => setByNo(null)}>Cancel</button>
                  </div>
                  {byNo.exerciseId && (
                    <ol className="small" style={{ maxHeight: 180, overflow: "auto", margin: "8px 0 0", paddingLeft: 26 }}>
                      {bookItems.filter((q) => q.exerciseId === byNo.exerciseId).map((q) => (
                        <li key={q.id} style={{ opacity: allowedInSection(q as QuestionSnapshot, s.questionType) ? 1 : 0.4 }}>
                          <span className="badge">{QTYPE_SHORT[q.type]}</span> {q.qNo && <b>({q.qNo})</b>} {q.text.slice(0, 110)} {used.has(q.id) && <span className="badge ok">in paper</span>}
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
              {custom?.sec === si && (
                <div className="card" style={{ marginTop: 8 }}>
                  <QuestionForm compact lockType value={custom.draft} onChange={(d) => setCustom({ sec: si, draft: { ...d, type: s.questionType } })} />
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn-sm" onClick={() => { updateSec(si, { questions: [...s.questions, toSnapshot({ ...custom.draft, type: s.questionType }, s.marksEach, s.questionType)] }); setCustom(null); }}>Add to section</button>
                    <button className="btn-ghost btn-sm" onClick={() => setCustom(null)}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ---------- 3. Save ---------- */}
      <div className="card row" style={{ position: "sticky", bottom: 0, zIndex: 3 }}>
        <b>Total marks: {total}</b>
        <span className="muted small">{sections.reduce((a, s) => a + s.questions.length, 0)} questions</span>
        <span className="spacer" />
        <button disabled={saving} onClick={save}>{saving ? "Saving…" : initial ? "Save changes & preview" : "Save paper & preview"}</button>
      </div>
    </div>
  );
}
