"use client";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import MathText, { UrduText } from "./MathText";
import TracingLines from "./TracingLines";
import OmrSheet from "./OmrSheet";
import { SvgIcon } from "./SvgIcons";
import { copyDims, DEFAULT_PRINT, omrInner, PAPER_SIZES, pageCss } from "@/lib/paperSizes";
import { sectionMarks } from "@/lib/templates";
import { OPTION_LETTERS } from "@/lib/omrLayout";
import { allowedInSection, normalizeForSection } from "@/lib/questionRules";
import { PAPER_TYPE_LABEL, type PaperDTO, type PaperSection, type PaperSize, type PrintSettings, type QuestionSnapshot } from "@/lib/types";

const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "PaperMaker PK";
const URDU_OPTS = ["الف", "ب", "ج", "د", "ہ"];
const ROMAN = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x", "xi", "xii", "xiii", "xiv", "xv", "xvi", "xvii", "xviii", "xix", "xx"];

/* ---------- helpers ---------- */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    const j = Math.abs(h) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
const matchOrder = (q: QuestionSnapshot) => seededShuffle((q.matchPairs ?? []).map((_, i) => i), q.id);
const qNumber = (sec: PaperSection, i: number) => (sec.questionType === "SHORT" ? `(${ROMAN[i] ?? i + 1})` : `${i + 1}.`);

/** "9th - Computer Science - Annual Examination - 16 Dec 2026" — becomes the PDF file name in the print dialog. */
export function paperFileName(paper: Pick<PaperDTO, "title" | "paperType" | "examDate" | "className" | "subjectName">) {
  const type = String(paper.paperType ?? "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  const date = paper.examDate ? new Date(paper.examDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
  const parts = [paper.className, paper.subjectName, paper.title, type, date].map((x) => (x ?? "").trim()).filter(Boolean);
  const uniq = parts.filter((x, i) => parts.findIndex((y) => y.toLowerCase() === x.toLowerCase()) === i);
  return uniq.join(" - ").replace(/[\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim().slice(0, 120) || "Exam Paper";
}

/** Prints with the paper's name as the document title, so "Save as PDF" suggests that file name. */
export function printWithName(paper: Parameters<typeof paperFileName>[0]) {
  const old = document.title;
  document.title = paperFileName(paper);
  const restore = () => { document.title = old; window.removeEventListener("afterprint", restore); };
  window.addEventListener("afterprint", restore);
  window.print();
  setTimeout(restore, 60000);
}

export function objectiveMcqs(paper: Pick<PaperDTO, "sections">) {
  return paper.sections.filter((s) => s.isObjective && s.questionType === "MCQ").flatMap((s) => s.questions.map((q) => ({ q, marks: s.marksEach })));
}

/* ---------- question renderer ---------- */
function QuestionBody({ q, sec, rtl, cols }: { q: QuestionSnapshot; sec: PaperSection; rtl: boolean; cols: number }) {
  const labels = rtl ? URDU_OPTS : OPTION_LETTERS;
  const opts = q.options ?? [];
  const longest = Math.max(0, ...opts.map((o) => o.replace(/\$[^$]*\$/g, "xxxx").length));
  // Strict layout: 4 options in one row when short, otherwise a 2 × 2 grid. Never wraps back onto the stem line.
  const optClass = cols === 1 && longest <= 18 && opts.length <= 4 ? "four" : "two";

  return (
    <>
      {q.text && <MathText as="div" text={q.text} className={q.type === "MISSING_LETTERS" ? "missing" : q.type === "CASE_STUDY" ? "case-box" : "q-stem"} />}
      <UrduText text={q.urduText} />
      {q.imageSnippet && <img className="snip" src={q.imageSnippet} alt="" />}
      {q.icon && <SvgIcon name={q.icon} size={20} />}

      {q.type === "MCQ" && opts.length > 0 && (
        <div className={`opts ${optClass}`}>
          {opts.map((o, i) => (
            <div key={i} className="opt">
              <span className="opt-l">({labels[i]})</span>
              <MathText className="opt-t" text={o} />
            </div>
          ))}
        </div>
      )}

      {q.type === "TRUE_FALSE" && <div style={{ textAlign: rtl ? "left" : "right" }}>{rtl ? "( درست / غلط )" : "( True / False )"}</div>}

      {q.type === "MATCH_COLUMNS" && q.matchPairs && (
        <table className="match">
          <thead>
            <tr><th>{rtl ? "حصہ الف" : "Column A"}</th><th>{rtl ? "حصہ ب" : "Column B"}</th><th style={{ width: "18mm" }}>{rtl ? "جواب" : "Answer"}</th></tr>
          </thead>
          <tbody>
            {(() => {
              const order = matchOrder(q);
              return q.matchPairs.map((p, i) => (
                <tr key={i}>
                  <td>{i + 1}. <MathText text={p.left} /></td>
                  <td>({String.fromCharCode(97 + i)}) <MathText text={q.matchPairs![order[i]].right} /></td>
                  <td />
                </tr>
              ));
            })()}
          </tbody>
        </table>
      )}

      {q.type === "DICTATION" && <TracingLines style="FOUR_LINE" rows={1} />}
      {q.type === "TRACING" && <TracingLines style={q.lineStyle ?? "FOUR_LINE"} rows={q.lineCount || 2} traceText={q.answer || q.text.replace(/\$|\n/g, " ").slice(0, 40)} />}
      {q.type === "PICTURE" && !q.needsLines && <TracingLines style="FOUR_LINE" rows={1} />}
      {q.needsLines && q.type !== "TRACING" && <TracingLines style={q.lineStyle ?? "PLAIN"} rows={q.lineCount || 2} />}
    </>
  );
}

function SectionBlock({ sec: raw, rtl: paperRtl, cols }: { sec: PaperSection; rtl: boolean; cols: number }) {
  // Strict rendering: MCQs only in MCQ sections; short/long sections never show option arrays.
  const sec = { ...raw, questions: raw.questions.filter((q) => allowedInSection(q, raw.questionType)).map((q) => normalizeForSection(q, raw.questionType)) };
  const rtl = paperRtl || !!sec.rtl;
  const marks = sectionMarks(sec);
  const n = sec.attemptAny && sec.attemptAny < sec.questions.length ? sec.attemptAny : sec.questions.length;
  return (
    <div className={`sec ${sec.pageBreakBefore ? "page-break" : ""} ${rtl ? "paper-rtl" : ""}`} dir={rtl ? "rtl" : undefined}>
      <div className={`sec-head ${rtl ? "urdu" : ""}`}>
        <span><MathText text={sec.title} /></span>
        <span className="marks" dir="ltr">{sec.questionType === "MATCH_COLUMNS" ? `${marks}` : `(${n} × ${sec.marksEach} = ${marks})`}{sec.partsNote ? ` · ${sec.partsNote}` : ""}</span>
      </div>
      {(sec.instructions || sec.timeNote) && <div className="sec-inst">{[sec.timeNote, sec.instructions].filter(Boolean).join(" — ")}</div>}
      {sec.urduInstructions && <UrduText text={sec.urduInstructions} />}
      {sec.questions.map((q, i) => (
        <div className={`q ${q.type === "MCQ" ? "q-mcq" : ""}`} key={q.id + i}>
          <div className="qn">{sec.questionType === "MATCH_COLUMNS" && sec.questions.length === 1 ? "" : qNumber(sec, i)}</div>
          <div className="qb"><QuestionBody q={q} sec={sec} rtl={rtl} cols={cols} /></div>
        </div>
      ))}
    </div>
  );
}

function PaperHeader({ paper }: { paper: PaperDTO }) {
  const date = paper.examDate ? new Date(paper.examDate).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }) : "";
  return (
    <div className="paper-header">
      {/* Centred block: logo, school, exam title, subject / paper type */}
      <div className="ph-center">
        {paper.institution.logoDataUrl && <img className="logo" src={paper.institution.logoDataUrl} alt="" />}
        <div className="inst">{paper.institution.name}</div>
        {(paper.institution.address || paper.institution.city) && <div className="sub">{[paper.institution.address, paper.institution.city].filter(Boolean).join(", ")}</div>}
        <div className="exam">{paper.title || PAPER_TYPE_LABEL[paper.paperType]}</div>
        <div className="subj">{[paper.subjectName, PAPER_TYPE_LABEL[paper.paperType]].filter(Boolean).join(" — ")}</div>
      </div>
      {/* Full-width, left-aligned student metadata grid */}
      <table className="meta-table">
        <colgroup><col style={{ width: "16%" }} /><col style={{ width: "32%" }} /><col style={{ width: "21%" }} /><col style={{ width: "31%" }} /></colgroup>
        <tbody>
          <tr><th>Name</th><td colSpan={3} className="blank" /></tr>
          <tr><th>Roll No</th><td className="blank" /><th>Class</th><td>{paper.className ?? ""}</td></tr>
          <tr><th>Section</th><td className="blank" /><th>Date</th><td className={date ? "" : "blank"}>{date}</td></tr>
          <tr><th>Time Allowed</th><td>{paper.timeAllowed ?? ""}</td><th>Maximum Marks</th><td>{paper.totalMarks}</td></tr>
        </tbody>
      </table>
    </div>
  );
}

function AnswerKey({ paper }: { paper: PaperDTO }) {
  const blocks = paper.sections
    .map((sec) => {
      const items: { n: string; a: string }[] = [];
      sec.questions.forEach((q, i) => {
        const n = qNumber(sec, i);
        if (q.type === "MCQ" && q.correctOption != null) items.push({ n, a: OPTION_LETTERS[q.correctOption] });
        else if (q.type === "MATCH_COLUMNS" && q.matchPairs) {
          const order = matchOrder(q);
          q.matchPairs.forEach((_, li) => items.push({ n: `${li + 1}`, a: String.fromCharCode(97 + order.indexOf(li)) }));
        } else if (q.answer && ["TRUE_FALSE", "FILL_BLANK", "MISSING_LETTERS", "DICTATION", "NUMERICAL"].includes(q.type)) items.push({ n, a: q.answer });
        else if (q.type === "DICTATION") items.push({ n, a: q.text });
      });
      return { sec, items };
    })
    .filter((b) => b.items.length);
  if (!blocks.length) return null;
  return (
    <div className="answer-key">
      <h3 style={{ textAlign: "center", margin: "0 0 2mm" }}>Teacher&apos;s Answer Key — {paper.title}</h3>
      <div className="small" style={{ textAlign: "center", marginBottom: "3mm" }}>{[paper.className, paper.subjectName].filter(Boolean).join(" • ")} — Confidential</div>
      {blocks.map(({ sec, items }) => (
        <div key={sec.id} className="sec">
          <div className="sec-head"><span>{sec.title}</span></div>
          <div className="keygrid">
            {items.map((it, i) => (
              <div key={i}><b>{it.n}</b> {it.a}</div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/** One full copy of the paper (header + sections). */
function PaperCopy({ paper, s, rtl }: { paper: PaperDTO; s: PrintSettings; rtl: boolean }) {
  return (
    <>
      <PaperHeader paper={paper} />
      <div className={`paper-body ${s.columns === 2 ? "cols-2" : ""} ${rtl ? "paper-rtl" : ""}`} dir={rtl ? "rtl" : undefined}>
        {paper.sections.map((sec) => (
          <SectionBlock key={sec.id} sec={sec} rtl={rtl} cols={s.columns} />
        ))}
      </div>
    </>
  );
}

/* ---------- main component ---------- */
export default function ExamPaperPreview({ paper, editable = true }: { paper: PaperDTO; editable?: boolean }) {
  const router = useRouter();
  const [s, setS] = useState<PrintSettings>({ ...DEFAULT_PRINT, ...(paper.printSettings ?? {}) });
  const [overflow, setOverflow] = useState(false);
  const [busy, setBusy] = useState(false);
  const copyRef = useRef<HTMLDivElement>(null);
  const rtl = !!paper.subjectIsUrdu;
  const mcqs = useMemo(() => objectiveMcqs(paper), [paper]);
  const twoUp = s.size === "A5_2UP";
  const dims = copyDims(s);
  const innerH = dims.h - 2 * s.marginMm;
  const optionCount = Math.max(4, ...mcqs.map((m) => m.q.options?.length ?? 4));

  // Inject the dynamic @page rule (size + margin) whenever settings change.
  useEffect(() => {
    let el = document.getElementById("dyn-page-rule") as HTMLStyleElement | null;
    if (!el) {
      el = document.createElement("style");
      el.id = "dyn-page-rule";
      document.head.appendChild(el);
    }
    el.textContent = pageCss(s);
    return () => {
      el?.remove();
    };
  }, [s]);

  // Remember the teacher's last print settings for this paper (debounced).
  useEffect(() => {
    if (!editable) return;
    const t = setTimeout(() => {
      fetch(`/api/papers/${paper.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ printSettings: s }) }).catch(() => {});
    }, 800);
    return () => clearTimeout(t);
  }, [s, paper.id, editable]);

  // A5 2-up must fit on one half-page: warn if it overflows.
  useLayoutEffect(() => {
    if (!twoUp || !copyRef.current) return setOverflow(false);
    const el = copyRef.current;
    setOverflow(el.scrollHeight > el.clientHeight + 2);
  }, [twoUp, s, paper]);

  const set = <K extends keyof PrintSettings>(k: K, v: PrintSettings[K]) => setS((p) => ({ ...p, [k]: v }));

  async function openResults() {
    setBusy(true);
    const r = await fetch(`/api/papers/${paper.id}/results`, { method: "POST" });
    const d = await r.json();
    setBusy(false);
    if (r.ok) router.push(`/dashboard/papers/${paper.id}/result?session=${d.id}`);
    else alert(d.error ?? "Could not open result session");
  }

  const watermark = paper.watermark ? <div className={`watermark ${twoUp ? "abs" : ""}`}>{paper.watermarkText ?? `FREE TRIAL • ${APP}`}</div> : null;
  const vars = { "--paper-font": `${s.fontSize}pt` } as React.CSSProperties;

  return (
    <div>
      {/* -------- Controls (never printed) -------- */}
      <div className="card no-print">
        <div className="row top">
          <div style={{ minWidth: 250 }}>
            <label>Paper size</label>
            <select value={s.size} onChange={(e) => set("size", e.target.value as PaperSize)}>
              {(Object.keys(PAPER_SIZES) as PaperSize[]).map((k) => (
                <option key={k} value={k}>{PAPER_SIZES[k].label}</option>
              ))}
            </select>
            <div className="small muted">{PAPER_SIZES[s.size].hint}</div>
          </div>
          <div>
            <label>Orientation</label>
            <select value={twoUp ? "portrait" : s.orientation} disabled={twoUp} onChange={(e) => set("orientation", e.target.value as PrintSettings["orientation"])}>
              <option value="portrait">Portrait</option>
              <option value="landscape">Landscape</option>
            </select>
          </div>
          <div>
            <label>Layout</label>
            <select value={s.columns} onChange={(e) => set("columns", Number(e.target.value) as 1 | 2)}>
              <option value={1}>1 Column</option>
              <option value={2}>2 Column split</option>
            </select>
          </div>
          <div style={{ width: 150 }}>
            <label>Font size: {s.fontSize}pt</label>
            <input type="range" min={8} max={16} step={0.5} value={s.fontSize} onChange={(e) => set("fontSize", Number(e.target.value))} />
          </div>
          <div style={{ width: 130 }}>
            <label>Margin: {s.marginMm}mm</label>
            <input type="range" min={5} max={20} value={s.marginMm} onChange={(e) => set("marginMm", Number(e.target.value))} />
          </div>
          <div>
            <label>Extras</label>
            <label className="check"><input type="checkbox" checked={s.showKey} onChange={(e) => set("showKey", e.target.checked)} /> Teacher&apos;s MCQ Answer Key</label>
            {mcqs.length > 0 && !twoUp && (
              <label className="check"><input type="checkbox" checked={s.showOmr} onChange={(e) => set("showOmr", e.target.checked)} /> OMR bubble sheet ({mcqs.length} MCQs)</label>
            )}
          </div>
        </div>
        <div className="row" style={{ marginTop: 12 }}>
          <button onClick={() => printWithName(paper)}>🖨️ Print / Save as PDF</button>
          {editable && <a className="btn btn-ghost" href={`/dashboard/papers/${paper.id}/edit`}>Edit paper</a>}
          <span className="spacer" />
          {editable && (
            <button className="btn-ghost" disabled={busy} onClick={openResults}>📊 Generate Class Result (Optional)</button>
          )}
        </div>
        <div className="small muted" style={{ marginTop: 8 }}>
          In the print dialog set <b>Destination: Save as PDF</b> (the file name is filled in for you), the same paper size, Margins <b>Default</b> and Scale <b>100%</b>. Untick “Headers and footers” to hide the date and web address.
          {s.showKey && " The answer key prints on its own page — remove that page before photocopying for students."}
        </div>
        {overflow && <div className="alert" style={{ marginTop: 10 }}>This paper is longer than one A5 half-page. Reduce the font size/margin, remove questions, or choose A4.</div>}
        {paper.watermark && <div className="alert" style={{ marginTop: 10 }}>Free-trial papers carry a light watermark. <a href="/dashboard/billing">Upgrade to Pro</a> to remove it.</div>}
      </div>

      {/* -------- Printable paper -------- */}
      <div className="paper-stage" style={vars}>
        {twoUp ? (
          <div>
            <div className="twoup-sheet" style={{ width: "297mm", height: "210mm" }}>
              {[0, 1].map((i) => (
                <div key={i} className="twoup-copy" ref={i === 0 ? copyRef : undefined} style={{ width: "148.5mm", height: "210mm", padding: `${Math.max(5, s.marginMm * 0.7)}mm` }}>
                  {watermark}
                  <PaperCopy paper={paper} s={s} rtl={rtl} />
                </div>
              ))}
            </div>
            {s.showKey && (
              <div className="sheet" style={{ width: "297mm", padding: "10mm", marginTop: 20 }}>
                <AnswerKey paper={paper} />
              </div>
            )}
          </div>
        ) : (
          <div className="sheet" style={{ width: `${dims.w}mm`, minHeight: `${dims.h}mm`, padding: `${s.marginMm}mm`, ["--page-h" as string]: `${innerH}mm` }}>
            {watermark}
            <PaperCopy paper={paper} s={s} rtl={rtl} />
            {s.showOmr && mcqs.length > 0 && (
              <div className="omr-page">
                <OmrSheet
                  mcqCount={mcqs.length}
                  optionCount={optionCount}
                  widthMm={omrInner(s).w}
                  maxHeightMm={omrInner(s).h - 2}
                  institution={paper.institution.name}
                  title={paper.title}
                  className={paper.className}
                  subjectName={paper.subjectName}
                />
              </div>
            )}
            {s.showKey && <AnswerKey paper={paper} />}
          </div>
        )}
      </div>
    </div>
  );
}
