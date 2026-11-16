"use client";
import { useCallback, useEffect, useState } from "react";
import QuestionForm, { cleanDraft, emptyDraft, type DraftQuestion } from "./QuestionForm";
import PdfBookPaperExtractor from "./PdfBookPaperExtractor";
import MathText from "./MathText";
import { SvgIcon } from "./SvgIcons";
import { api, useCatalog } from "./useCatalog";
import { cachedGet } from "@/lib/clientCache";
import { parseNumberList } from "@/lib/bookParse";
import { LEVEL_LABEL, QTYPE_LABEL, type Level, type QType } from "@/lib/types";

interface BankQ extends DraftQuestion { id: string }

export default function QuestionBank() {
  const { classes, reload } = useCatalog();
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [chapterId, setChapterId] = useState("");
  const [tab, setTab] = useState<"manual" | "pdf" | "list">("list");
  const [draft, setDraft] = useState<DraftQuestion>(emptyDraft("MCQ"));
  const [questions, setQuestions] = useState<BankQ[]>([]);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState({ cls: "", level: "PRIMARY" as Level, subject: "", subjectUrdu: false, chapter: "" });

  const cls = classes.find((c) => c.id === classId);
  const sub = cls?.subjects.find((s) => s.id === subjectId);

  const loadQuestions = useCallback(async () => {
    if (!chapterId) return setQuestions([]);
    const d = await cachedGet<{ questions: BankQ[] }>(`/api/questions?full=1&chapterIds=${chapterId}`);
    setQuestions(d.questions);
  }, [chapterId]);
  useEffect(() => {
    loadQuestions();
  }, [loadQuestions]);

  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(""), 3000); };

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
    if (kind === "chapter") setChapterId("");
    reload();
  }

  async function saveDrafts(drafts: DraftQuestion[]) {
    if (!chapterId) throw new Error("Select a chapter first");
    await api("/api/questions", "POST", { chapterId, questions: drafts.map(cleanDraft) });
    await Promise.all([loadQuestions(), reload()]);
  }

  return (
    <div className="sidebar-layout">
      {/* ---------- Catalog tree ---------- */}
      <div className="card">
        <h3>Classes</h3>
        <ul className="list-plain" style={{ maxHeight: 220, overflow: "auto" }}>
          {classes.map((c) => (
            <li key={c.id} className={`tree-item ${c.id === classId ? "active" : ""}`} onClick={() => { setClassId(c.id); setSubjectId(""); setChapterId(""); }}>
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
                <li key={s.id} className={`tree-item ${s.id === subjectId ? "active" : ""}`} onClick={() => { setSubjectId(s.id); setChapterId(""); }}>
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
              {sub.chapters.map((ch) => (
                <li key={ch.id} className={`tree-item ${ch.id === chapterId ? "active" : ""}`} onClick={() => setChapterId(ch.id)}>
                  {ch.number}. {ch.title} <span className="small muted">({ch._count.questions})</span>{" "}
                  <button
                    className={`btn-sm ${ch.isAlp ? "" : "btn-ghost"}`}
                    style={{ padding: "0 6px", fontSize: 10 }}
                    title="Smart Syllabus / ALP chapter"
                    onClick={async (e) => { e.stopPropagation(); await api("/api/catalog", "PATCH", { kind: "chapter", id: ch.id, isAlp: !ch.isAlp }); reload(); }}
                  >ALP{ch.isAlp ? " ✓" : ""}</button>
                </li>
              ))}
            </ul>
            <div className="row" style={{ gap: 4, marginTop: 6, flexWrap: "nowrap" }}>
              <input placeholder="New chapter / unit" value={newName.chapter} onChange={(e) => setNewName({ ...newName, chapter: e.target.value })} />
              <button className="btn-sm" onClick={() => addCatalog("chapter")}>+</button>
            </div>
            <button className="btn-ghost btn-sm" style={{ marginTop: 6 }} title="Smart Syllabus / ALP chapters" onClick={async () => {
              const input = prompt("Smart Syllabus / ALP chapter numbers (e.g. 1, 2, 4-6). Leave empty to clear.", sub.chapters.filter((c) => c.isAlp).map((c) => c.number).join(", "));
              if (input === null) return;
              const want = new Set(parseNumberList(input, 999));
              for (const c of sub.chapters) if (!!c.isAlp !== want.has(c.number)) await api("/api/catalog", "PATCH", { kind: "chapter", id: c.id, isAlp: want.has(c.number) });
              reload();
            }}>📋 Smart Syllabus chapters</button>
            <div className="row" style={{ gap: 4, marginTop: 6 }}>
              <button className="btn-danger btn-sm" onClick={() => removeCatalog("subject", sub.id)}>Delete subject</button>
              {chapterId && <button className="btn-danger btn-sm" onClick={() => removeCatalog("chapter", chapterId)}>Delete chapter</button>}
            </div>
          </>
        )}
      </div>

      {/* ---------- Questions ---------- */}
      <div className="card" style={{ marginTop: 0 }}>
        <div className="tabs">
          <button className={tab === "list" ? "active" : ""} onClick={() => setTab("list")}>Questions ({questions.length})</button>
          <button className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>+ Add manually</button>
          <button className={tab === "pdf" ? "active" : ""} onClick={() => setTab("pdf")}>📘 Extract from textbook PDF</button>
        </div>
        {msg && <div className="alert">{msg}</div>}
        {!chapterId && <div className="alert">Pick a class → subject → chapter on the left. Questions are saved chapter-wise so papers can be built from selected chapters.</div>}

        {tab === "list" && (
          <div>
            {questions.map((q) => (
              <div className="qcard" key={q.id}>
                <div className="row">
                  <span className="badge">{QTYPE_LABEL[q.type as QType]}</span>
                  <span className="small muted">{q.marks} marks</span>
                  <span className="spacer" />
                  <button className="btn-danger btn-sm" onClick={async () => { await api(`/api/questions/${q.id}`, "DELETE"); loadQuestions(); reload(); }}>Delete</button>
                </div>
                <div style={{ fontFamily: "Times New Roman, serif", marginTop: 4 }}>
                  <MathText as="div" text={q.text} />
                  {q.urduText && <div className="urdu" dir="rtl">{q.urduText}</div>}
                  {q.options && <div className="small">{q.options.map((o, i) => <span key={i} style={{ marginRight: 12, fontWeight: q.correctOption === i ? 700 : 400 }}>({"ABCDE"[i]}) {o}</span>)}</div>}
                  {q.matchPairs && <div className="small">{q.matchPairs.map((p) => `${p.left} ↔ ${p.right}`).join(" · ")}</div>}
                  {q.icon && <SvgIcon name={q.icon} size={10} />}
                  {q.imageSnippet && <img src={q.imageSnippet} alt="" style={{ maxHeight: 90, display: "block" }} />}
                </div>
              </div>
            ))}
            {chapterId && !questions.length && <p className="muted">No questions in this chapter yet.</p>}
          </div>
        )}

        {tab === "manual" && (
          <div>
            <QuestionForm value={draft} onChange={setDraft} />
            <button
              style={{ marginTop: 12 }}
              disabled={!chapterId || (!draft.text && !draft.imageSnippet && !draft.urduText && !draft.matchPairs?.length)}
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

        {tab === "pdf" && <PdfBookPaperExtractor disabled={!chapterId} onSave={saveDrafts} />}
      </div>
    </div>
  );
}
