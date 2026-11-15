"use client";
import { useId, useState } from "react";
import MathText from "./MathText";
import { ICONS, ICON_KEYS, SvgIcon } from "./SvgIcons";
import { fileToCompressed } from "@/lib/clientImage";
import { QTYPE_LABEL, type MatchPair, type QType } from "@/lib/types";

export interface DraftQuestion {
  type: QType;
  text: string;
  urduText?: string | null;
  options?: string[] | null;
  correctOption?: number | null;
  answer?: string | null;
  matchPairs?: MatchPair[] | null;
  imageSnippet?: string | null;
  icon?: string | null;
  needsLines?: boolean;
  lineStyle?: "FOUR_LINE" | "SQUARE" | "PLAIN" | null;
  lineCount?: number;
  marks?: number;
  difficulty?: number;
}

export const emptyDraft = (type: QType = "MCQ"): DraftQuestion => ({
  type,
  text: "",
  options: type === "MCQ" ? ["", "", "", ""] : null,
  correctOption: type === "MCQ" ? 0 : null,
  matchPairs: type === "MATCH_COLUMNS" ? [{ left: "", right: "" }, { left: "", right: "" }, { left: "", right: "" }] : null,
  needsLines: type === "TRACING",
  lineStyle: type === "TRACING" ? "FOUR_LINE" : null,
  lineCount: 2,
  marks: 1,
  difficulty: 2,
});

/** Normalises a draft so it only carries fields its type uses. */
export function cleanDraft(d: DraftQuestion): DraftQuestion {
  return {
    ...d,
    options: d.type === "MCQ" ? (d.options ?? []).map((o) => o.trim()) : null,
    correctOption: d.type === "MCQ" ? d.correctOption ?? null : null,
    matchPairs: d.type === "MATCH_COLUMNS" ? (d.matchPairs ?? []).filter((p) => p.left.trim() || p.right.trim()) : null,
    urduText: d.urduText?.trim() || null,
    answer: d.answer?.trim() || null,
  };
}

export default function QuestionForm({ value, onChange, compact, lockType }: { value: DraftQuestion; onChange: (d: DraftQuestion) => void; compact?: boolean; lockType?: boolean }) {
  const [showPreview, setShowPreview] = useState(false);
  const uid = useId();
  const d = value;
  const set = <K extends keyof DraftQuestion>(k: K, v: DraftQuestion[K]) => onChange({ ...d, [k]: v });
  const changeType = (t: QType) => {
    const base = emptyDraft(t);
    onChange({ ...base, text: d.text, urduText: d.urduText, imageSnippet: d.imageSnippet, marks: d.marks });
  };

  return (
    <div>
      <div className="row top">
        <div style={{ flex: 2, minWidth: 180 }}>
          <label>Type</label>
          <select value={d.type} disabled={lockType} title={lockType ? "Type is fixed by the section" : undefined} onChange={(e) => changeType(e.target.value as QType)}>
            {(Object.keys(QTYPE_LABEL) as QType[]).map((t) => (
              <option key={t} value={t}>{QTYPE_LABEL[t]}</option>
            ))}
          </select>
        </div>
        <div style={{ width: 90 }}>
          <label>Marks</label>
          <input type="number" min={0} step={0.5} value={d.marks ?? 1} onChange={(e) => set("marks", Number(e.target.value))} />
        </div>
        <div style={{ width: 110 }}>
          <label>Difficulty</label>
          <select value={d.difficulty ?? 2} onChange={(e) => set("difficulty", Number(e.target.value))}>
            <option value={1}>Easy</option>
            <option value={2}>Medium</option>
            <option value={3}>Hard</option>
          </select>
        </div>
      </div>

      <div className="field">
        <label>
          {d.type === "TRACING" ? "Text to trace (e.g. A a B b / 1 2 3)" : d.type === "MISSING_LETTERS" ? "Word with gaps (e.g. C _ T, 1 2 _ 4)" : d.type === "DICTATION" ? "Dictation word (only shown in the answer key)" : "Question text"}
          <span className="muted"> — math: $x^2$, code: ```code```, blank: ___</span>
        </label>
        <textarea rows={compact ? 2 : 3} value={d.text} onChange={(e) => set("text", e.target.value)} />
      </div>

      {!compact && (
        <div className="field">
          <label>Urdu text (optional, right-to-left)</label>
          <textarea className="urdu" dir="rtl" rows={2} value={d.urduText ?? ""} onChange={(e) => set("urduText", e.target.value)} />
        </div>
      )}

      {d.type === "MCQ" && (
        <div className="field">
          <label>Options (select the correct one)</label>
          {(d.options ?? []).map((o, i) => (
            <div className="row" key={i} style={{ marginBottom: 4, flexWrap: "nowrap" }}>
              <input type="radio" name={`correct-${uid}`} checked={d.correctOption === i} onChange={() => set("correctOption", i)} />
              <b style={{ width: 18 }}>{"ABCDE"[i]}</b>
              <input value={o} onChange={(e) => set("options", (d.options ?? []).map((x, j) => (j === i ? e.target.value : x)))} />
            </div>
          ))}
          {(d.options?.length ?? 0) < 5 && (
            <button type="button" className="btn-ghost btn-sm" onClick={() => set("options", [...(d.options ?? []), ""])}>+ option</button>
          )}
        </div>
      )}

      {d.type === "MATCH_COLUMNS" && (
        <div className="field">
          <label>Pairs (Column A ↔ correct Column B — the print shuffles Column B)</label>
          {(d.matchPairs ?? []).map((p, i) => (
            <div className="row" key={i} style={{ marginBottom: 4, flexWrap: "nowrap" }}>
              <input placeholder="Column A" value={p.left} onChange={(e) => set("matchPairs", (d.matchPairs ?? []).map((x, j) => (j === i ? { ...x, left: e.target.value } : x)))} />
              <input placeholder="Column B" value={p.right} onChange={(e) => set("matchPairs", (d.matchPairs ?? []).map((x, j) => (j === i ? { ...x, right: e.target.value } : x)))} />
              <button type="button" className="btn-danger btn-sm" onClick={() => set("matchPairs", (d.matchPairs ?? []).filter((_, j) => j !== i))}>✕</button>
            </div>
          ))}
          <button type="button" className="btn-ghost btn-sm" onClick={() => set("matchPairs", [...(d.matchPairs ?? []), { left: "", right: "" }])}>+ pair</button>
        </div>
      )}

      {["TRUE_FALSE", "FILL_BLANK", "MISSING_LETTERS", "NUMERICAL", "SHORT", "TRACING"].includes(d.type) && (
        <div className="field">
          <label>{d.type === "TRUE_FALSE" ? "Answer (True / False)" : d.type === "TRACING" ? "Trace text override (optional)" : "Answer for key (optional)"}</label>
          {d.type === "TRUE_FALSE" ? (
            <select value={d.answer ?? ""} onChange={(e) => set("answer", e.target.value)}>
              <option value="">—</option>
              <option>True</option>
              <option>False</option>
            </select>
          ) : (
            <input value={d.answer ?? ""} onChange={(e) => set("answer", e.target.value)} />
          )}
        </div>
      )}

      {(d.type === "PICTURE" || !compact) && ["PICTURE", "MCQ", "FILL_BLANK", "TRUE_FALSE", "MISSING_LETTERS", "SHORT"].includes(d.type) && (
        <div className="field">
          <label>Built-in picture (free SVG icon)</label>
          <div className="row" style={{ gap: 4 }}>
            <button type="button" className={`btn-sm ${d.icon ? "btn-ghost" : ""}`} onClick={() => set("icon", null)}>None</button>
            {ICON_KEYS.map((k) => (
              <button type="button" key={k} title={ICONS[k].label} className={`btn-sm ${d.icon === k ? "" : "btn-ghost"}`} style={{ padding: 2 }} onClick={() => set("icon", k)}>
                <SvgIcon name={k} size={7} />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="row">
        <label className="check"><input type="checkbox" checked={!!d.needsLines} onChange={(e) => set("needsLines", e.target.checked)} /> Print writing lines</label>
        {d.needsLines && (
          <>
            <select style={{ width: 170 }} value={d.lineStyle ?? "PLAIN"} onChange={(e) => set("lineStyle", e.target.value as DraftQuestion["lineStyle"])}>
              <option value="PLAIN">Plain answer lines</option>
              <option value="FOUR_LINE">4-line English</option>
              <option value="SQUARE">Square math grid</option>
            </select>
            <input style={{ width: 70 }} type="number" min={1} max={30} value={d.lineCount ?? 2} onChange={(e) => set("lineCount", Number(e.target.value))} />
            <span className="small muted">rows</span>
          </>
        )}
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <label className="btn btn-ghost btn-sm" style={{ margin: 0, color: "var(--brand)" }}>
          📷 {d.imageSnippet ? "Replace image" : "Add diagram/image"}
          <input type="file" accept="image/*" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (f) set("imageSnippet", await fileToCompressed(f)); }} />
        </label>
        {d.imageSnippet && <><img src={d.imageSnippet} alt="" style={{ height: 40, border: "1px solid #ddd" }} /><button type="button" className="btn-danger btn-sm" onClick={() => set("imageSnippet", null)}>Remove image</button></>}
        <span className="spacer" />
        <button type="button" className="btn-ghost btn-sm" onClick={() => setShowPreview((v) => !v)}>{showPreview ? "Hide" : "Preview"}</button>
      </div>
      {showPreview && d.text && <div className="qcard" style={{ marginTop: 8, fontFamily: "Times New Roman, serif" }}><MathText as="div" text={d.text} /></div>}
    </div>
  );
}
