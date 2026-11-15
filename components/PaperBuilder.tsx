"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import QuestionForm, { cleanDraft, emptyDraft, type DraftQuestion } from "./QuestionForm";
import MathText from "./MathText";
import { api, useCatalog } from "./useCatalog";
import { TEMPLATES, paperTotal, sectionMarks } from "@/lib/templates";
import { PAPER_TYPE_LABEL, QTYPE_LABEL, type PaperSection, type PaperTypeT, type PrintSettings, type QType, type QuestionSnapshot } from "@/lib/types";

type BankQ = DraftQuestion & { id: string; chapterId: string };
type BSection = PaperSection & { count: number };

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
}

const rid = () => Math.random().toString(36).slice(2, 10);
const shuffle = <T,>(a: T[]) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };

function toSnapshot(q: DraftQuestion & { id?: string }, marks: number): QuestionSnapshot {
  const c = cleanDraft(q);
  return {
    id: q.id ?? `custom-${rid()}`,
    type: c.type, text: c.text, urduText: c.urduText, options: c.options, correctOption: c.correctOption, answer: c.answer,
    matchPairs: c.matchPairs, imageSnippet: c.imageSnippet, icon: c.icon, needsLines: !!c.needsLines, lineStyle: c.lineStyle ?? null,
    lineCount: c.lineCount ?? 2, marks,
  };
}

export default function PaperBuilder({ initial }: { initial?: BuilderInitial }) {
  const router = useRouter();
  const { classes } = useCatalog();
  const [meta, setMeta] = useState({
    title: initial?.title ?? "",
    paperType: (initial?.paperType ?? "MONTHLY") as PaperTypeT,
    examDate: initial?.examDate?.slice(0, 10) ?? "",
    timeAllowed: initial?.timeAllowed ?? "",
    classId: initial?.classId ?? "",
    subjectId: initial?.subjectId ?? "",
  });
  const [chapterIds, setChapterIds] = useState<string[]>([]);
  const [sections, setSections] = useState<BSection[]>(() => (initial?.sections ?? []).map((s) => ({ ...s, count: s.questions.length })));
  const [bank, setBank] = useState<BankQ[]>([]);
  const [custom, setCustom] = useState<{ sec: number; draft: DraftQuestion } | null>(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  const cls = classes.find((c) => c.id === meta.classId);
  const sub = cls?.subjects.find((s) => s.id === meta.subjectId);
  const total = paperTotal(sections);
  const used = useMemo(() => new Set(sections.flatMap((s) => s.questions.map((q) => q.id))), [sections]);
  const templates = useMemo(() => (cls ? [...TEMPLATES].sort((a, b) => Number(b.level.includes(cls.level)) - Number(a.level.includes(cls.level))) : TEMPLATES), [cls]);

  // Load bank questions for the selected chapters (or all chapters of the subject).
  useEffect(() => {
    const ids = chapterIds.length ? chapterIds : sub?.chapters.map((c) => c.id) ?? [];
    if (!ids.length) return setBank([]);
    api<{ questions: BankQ[] }>(`/api/questions?take=500&chapterIds=${ids.join(",")}`, "GET").then((d) => setBank(d.questions)).catch(() => setBank([]));
  }, [chapterIds, sub]);

  const updateSec = (i: number, patch: Partial<BSection>) => setSections((ss) => ss.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const pool = (type: QType) => bank.filter((q) => q.type === type && !used.has(q.id));

  function applyTemplate(key: string) {
    const t = TEMPLATES.find((x) => x.key === key);
    if (!t) return;
    if (sections.some((s) => s.questions.length) && !confirm("Replace current sections with this template?")) return;
    setSections(t.sections.map(({ count, ...s }) => ({ ...s, id: rid(), count, questions: [] })));
    if (!meta.timeAllowed) setMeta((m) => ({ ...m, timeAllowed: t.timeAllowed }));
  }

  function autofill() {
    const taken = new Set<string>();
    setSections((ss) =>
      ss.map((s) => {
        const keep = s.questions.filter((q) => q.id.startsWith("custom-"));
        keep.forEach((q) => taken.add(q.id));
        const avail = shuffle(bank.filter((q) => q.type === s.questionType && !taken.has(q.id)));
        const pick = avail.slice(0, Math.max(0, s.count - keep.length));
        pick.forEach((q) => taken.add(q.id));
        return { ...s, questions: [...keep, ...pick.map((q) => toSnapshot(q, s.questionType === "MATCH_COLUMNS" ? q.marks ?? s.marksEach : s.marksEach))] };
      }),
    );
  }

  function swap(si: number, qi: number) {
    const s = sections[si];
    const p = pool(s.questionType);
    if (!p.length) return alert("No more unused questions of this type in the selected chapters.");
    const q = p[Math.floor(Math.random() * p.length)];
    updateSec(si, { questions: s.questions.map((x, j) => (j === qi ? toSnapshot(q, s.marksEach) : x)) });
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
      sections: sections.filter((s) => s.questions.length).map(({ count: _c, ...s }) => s),
      printSettings: initial?.printSettings ?? null,
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
      setErr((e as Error).message);
      setSaving(false);
    }
  }

  return (
    <div>
      {err && <div className="alert err">{err}</div>}

      {/* ---------- 1. Paper details ---------- */}
      <div className="card">
        <h2>1. Paper details</h2>
        <div className="grid3">
          <div className="field">
            <label>Class</label>
            <select value={meta.classId} onChange={(e) => { setMeta({ ...meta, classId: e.target.value, subjectId: "" }); setChapterIds([]); }}>
              <option value="">— select —</option>
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Subject</label>
            <select value={meta.subjectId} onChange={(e) => { setMeta({ ...meta, subjectId: e.target.value }); setChapterIds([]); }}>
              <option value="">— select —</option>
              {cls?.subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
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
        {sub && (
          <div>
            <label>Syllabus — chapters (none ticked = whole subject) · {bank.length} questions available</label>
            <div className="row" style={{ gap: 10 }}>
              {sub.chapters.map((ch) => (
                <label key={ch.id} className="check">
                  <input type="checkbox" checked={chapterIds.includes(ch.id)} onChange={(e) => setChapterIds((ids) => (e.target.checked ? [...ids, ch.id] : ids.filter((x) => x !== ch.id)))} />
                  {ch.number}. {ch.title} <span className="muted small">({ch._count.questions})</span>
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
            {templates.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
          <button className="btn-ghost" onClick={() => setSections((ss) => [...ss, { id: rid(), title: `Q.${ss.length + 1}`, questionType: "SHORT", marksEach: 2, count: 5, questions: [] }])}>+ Section</button>
          <button disabled={!bank.length || !sections.length} onClick={autofill}>🎲 Auto-pick from bank</button>
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
                        {q.id.startsWith("custom-") && <span className="badge" style={{ marginLeft: 6 }}>custom</span>}
                      </div>
                      {!q.id.startsWith("custom-") && <button className="btn-ghost btn-sm" title="Swap with another question" onClick={() => swap(si, qi)}>⇄</button>}
                      <button className="btn-danger btn-sm" onClick={() => updateSec(si, { questions: s.questions.filter((_, j) => j !== qi) })}>✕</button>
                    </div>
                  </li>
                ))}
              </ol>
              <div className="row" style={{ marginTop: 6 }}>
                <span className={`small ${s.questions.length < s.count ? "" : "muted"}`} style={{ color: s.questions.length < s.count ? "var(--warn)" : undefined }}>
                  {s.questions.length}/{s.count} selected · {avail} unused in bank
                </span>
                <select style={{ width: 300 }} value="" onChange={(e) => { const q = bank.find((x) => x.id === e.target.value); if (q) updateSec(si, { questions: [...s.questions, toSnapshot(q, s.marksEach)] }); }}>
                  <option value="">+ add a specific question from bank…</option>
                  {pool(s.questionType).map((q) => <option key={q.id} value={q.id}>{(q.text || "[image]").slice(0, 90)}</option>)}
                </select>
                <button className="btn-ghost btn-sm" onClick={() => setCustom({ sec: si, draft: { ...emptyDraft(s.questionType), marks: s.marksEach } })}>+ Write a custom question</button>
              </div>
              {custom?.sec === si && (
                <div className="card" style={{ marginTop: 8 }}>
                  <QuestionForm compact value={custom.draft} onChange={(d) => setCustom({ sec: si, draft: d })} />
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn-sm" onClick={() => { updateSec(si, { questions: [...s.questions, toSnapshot(custom.draft, s.marksEach)] }); setCustom(null); }}>Add to section</button>
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
