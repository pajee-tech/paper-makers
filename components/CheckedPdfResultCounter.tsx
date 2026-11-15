"use client";
/**
 * Optional post-exam marks capture — everything runs in the teacher's browser (no server, no paid API):
 *   A) Manual keyboard grid (Enter/↑/↓ navigation, paste straight from Excel)
 *   A2) Excel / CSV upload via the free `xlsx` (SheetJS) library
 *   B) Checked answer-sheet PDF → pdfjs-dist renders each page → OMR bubble reading (lib/omrScan)
 *      → tesseract.js OCR of the examiner's written marks boxes → verification table → apply.
 */
import { useMemo, useRef, useState } from "react";
import { buildOmrLayout, OPTION_LETTERS } from "@/lib/omrLayout";
import { boxRect, readSheet, scoreMcq, toGray, type Corners, type McqMark } from "@/lib/omrScan";
import { loadPdfJs } from "@/lib/clientImage";
import type { PaperDTO, ScoreRow } from "@/lib/types";

/* ------------------------------------------------------------------ */
/* helpers                                                             */
/* ------------------------------------------------------------------ */
const num = (v: unknown) => {
  if (v === "" || v === null || v === undefined) return null;
  const n = Number(String(v).replace(/[^\d.]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export function answerKeyOf(paper: PaperDTO) {
  const qs = paper.sections.filter((s) => s.isObjective && s.questionType === "MCQ").flatMap((s) => s.questions.map((q) => ({ q, m: s.marksEach })));
  return {
    key: qs.map(({ q }) => (q.correctOption != null ? OPTION_LETTERS[q.correctOption] : null)),
    marks: qs.map(({ m }) => m),
    optionCount: Math.max(4, ...qs.map(({ q }) => q.options?.length ?? 4)),
  };
}

const withTotal = (r: ScoreRow): ScoreRow => {
  if (r.mcqObtained == null && r.subjectiveObtained == null) return r;
  return { ...r, obtained: (r.mcqObtained ?? 0) + (r.subjectiveObtained ?? 0) };
};

const blankRow = (rollNo = ""): ScoreRow => ({ rollNo, studentName: "", obtained: 0, source: "MANUAL" });

/* ------------------------------------------------------------------ */
/* A) manual grid                                                      */
/* ------------------------------------------------------------------ */
const COLS = ["rollNo", "studentName", "fatherName", "parentPhone", "mcqObtained", "subjectiveObtained", "obtained"] as const;
type Col = (typeof COLS)[number];
const NUMERIC: Col[] = ["mcqObtained", "subjectiveObtained", "obtained"];
const COL_LABEL: Record<Col, string> = { rollNo: "Roll No", studentName: "Student Name", fatherName: "Father Name", parentPhone: "Parent WhatsApp", mcqObtained: "MCQ", subjectiveObtained: "Subjective", obtained: "Obtained" };

function ManualGrid({ rows, onChange, totalMarks, hasMcq }: { rows: ScoreRow[]; onChange: (r: ScoreRow[]) => void; totalMarks: number; hasMcq: boolean }) {
  const tableRef = useRef<HTMLTableElement>(null);
  const cols = COLS.filter((c) => hasMcq || (c !== "mcqObtained" && c !== "subjectiveObtained"));
  const focus = (r: number, c: number) => setTimeout(() => tableRef.current?.querySelector<HTMLInputElement>(`input[data-r="${r}"][data-c="${c}"]`)?.focus(), 0);

  const setCell = (ri: number, col: Col, raw: string) => {
    const next = rows.map((r, i) => {
      if (i !== ri) return r;
      const v = NUMERIC.includes(col) ? num(raw) : raw;
      const nr = { ...r, [col]: col === "obtained" ? v ?? 0 : v, source: r.source ?? "MANUAL" } as ScoreRow;
      return col === "mcqObtained" || col === "subjectiveObtained" ? withTotal(nr) : nr;
    });
    onChange(next);
  };

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, ri: number, ci: number) => {
    if (e.key === "Enter" || e.key === "ArrowDown") {
      e.preventDefault();
      if (ri === rows.length - 1) onChange([...rows, blankRow(String((Number(rows[ri].rollNo) || ri + 1) + 1))]);
      focus(ri + 1, ci);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      focus(Math.max(0, ri - 1), ci);
    }
  };

  // Paste a block copied from Excel / Google Sheets (tab-separated) starting at this cell.
  const onPaste = (e: React.ClipboardEvent<HTMLInputElement>, ri: number, ci: number) => {
    const text = e.clipboardData.getData("text");
    if (!/[\t\n]/.test(text)) return;
    e.preventDefault();
    const lines = text.replace(/\r/g, "").split("\n").filter((l) => l.length);
    const next = [...rows];
    lines.forEach((line, li) => {
      const cells = line.split("\t");
      const idx = ri + li;
      if (!next[idx]) next[idx] = blankRow();
      let r = { ...next[idx] };
      cells.forEach((val, k) => {
        const col = cols[ci + k];
        if (!col) return;
        r = { ...r, [col]: NUMERIC.includes(col) ? (col === "obtained" ? num(val) ?? 0 : num(val)) : val.trim() } as ScoreRow;
      });
      next[idx] = withTotal(r);
    });
    onChange(next);
  };

  return (
    <div>
      <div className="row" style={{ marginBottom: 8 }}>
        <button className="btn-ghost btn-sm" onClick={() => onChange([...rows, blankRow(String(rows.length + 1))])}>+ Row</button>
        <button className="btn-ghost btn-sm" onClick={() => { const n = Number(prompt("How many students?", "30")); if (n > 0) onChange([...rows, ...Array.from({ length: n }, (_, i) => blankRow(String(rows.length + i + 1)))]); }}>+ Add class (roll 1…N)</button>
        <span className="small muted">Enter / ↓ moves down, ↑ moves up. Paste a block copied from Excel into any cell.</span>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="tbl" ref={tableRef}>
          <thead>
            <tr>
              <th>#</th>
              {cols.map((c) => <th key={c}>{COL_LABEL[c]}{c === "obtained" ? ` / ${totalMarks}` : ""}</th>)}
              <th>Absent</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, ri) => (
              <tr key={ri} style={{ opacity: r.absent ? 0.55 : 1 }}>
                <td className="small muted">{ri + 1}</td>
                {cols.map((c, ci) => (
                  <td key={c} style={{ minWidth: c === "studentName" || c === "fatherName" ? 150 : c === "parentPhone" ? 130 : 70 }}>
                    <input
                      data-r={ri}
                      data-c={ci}
                      inputMode={NUMERIC.includes(c) || c === "parentPhone" ? "decimal" : undefined}
                      value={(r[c] ?? "") as string | number}
                      onChange={(e) => setCell(ri, c, e.target.value)}
                      onKeyDown={(e) => onKey(e, ri, ci)}
                      onPaste={(e) => onPaste(e, ri, ci)}
                      style={c === "obtained" && r.obtained > totalMarks ? { borderColor: "var(--danger)" } : undefined}
                    />
                  </td>
                ))}
                <td style={{ textAlign: "center" }}><input type="checkbox" checked={!!r.absent} onChange={(e) => onChange(rows.map((x, i) => (i === ri ? { ...x, absent: e.target.checked } : x)))} /></td>
                <td><button className="btn-danger btn-sm" onClick={() => onChange(rows.filter((_, i) => i !== ri))}>✕</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* A2) Excel / CSV                                                     */
/* ------------------------------------------------------------------ */
const HEADER_MATCH: [Col | "absent", RegExp][] = [
  ["rollNo", /roll|reg|seat/i],
  ["fatherName", /father|f\.?\s*name|guardian/i],
  ["studentName", /name|student/i],
  ["parentPhone", /phone|mobile|contact|whats|cell/i],
  ["mcqObtained", /mcq|objective|part.?i\b/i],
  ["subjectiveObtained", /subjective|written|part.?ii/i],
  ["obtained", /obtain|marks|total|score/i],
  ["absent", /absent|status/i],
];

function ExcelImport({ rows, onChange }: { rows: ScoreRow[]; onChange: (r: ScoreRow[]) => void }) {
  const [preview, setPreview] = useState<ScoreRow[] | null>(null);
  const [mapping, setMapping] = useState<string>("");
  const [err, setErr] = useState("");

  async function onFile(f: File) {
    setErr("");
    try {
      const XLSX = await import("xlsx");
      const wb = XLSX.read(await f.arrayBuffer(), { type: "array" });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, blankrows: false, defval: "" });
      // header row = first row that matches ≥2 known columns
      const hi = grid.findIndex((r) => r.filter((c) => HEADER_MATCH.some(([, re]) => re.test(String(c)))).length >= 2);
      if (hi < 0) throw new Error("Could not find a header row. Use columns like: Roll No, Name, Father Name, Phone, MCQ, Subjective, Obtained.");
      const header = grid[hi].map(String);
      const map: Partial<Record<Col | "absent", number>> = {};
      header.forEach((h, i) => {
        const hit = HEADER_MATCH.find(([k, re]) => re.test(h) && map[k] === undefined && !(k === "studentName" && /father/i.test(h)));
        if (hit) map[hit[0]] = i;
      });
      setMapping(Object.entries(map).map(([k, i]) => `${COL_LABEL[k as Col] ?? "Absent"} ← "${header[i as number]}"`).join(" · "));
      const out = grid.slice(hi + 1).map((r) => {
        const g = (k: Col | "absent") => (map[k] !== undefined ? r[map[k]!] : "");
        const row: ScoreRow = {
          rollNo: String(g("rollNo") ?? "").trim(),
          studentName: String(g("studentName") ?? "").trim(),
          fatherName: String(g("fatherName") ?? "").trim() || undefined,
          parentPhone: String(g("parentPhone") ?? "").trim() || undefined,
          mcqObtained: num(g("mcqObtained")),
          subjectiveObtained: num(g("subjectiveObtained")),
          obtained: num(g("obtained")) ?? 0,
          absent: /^(a|abs|absent)$/i.test(String(g("absent") || g("obtained")).trim()),
          source: "EXCEL",
        };
        return map.obtained === undefined ? withTotal(row) : row;
      }).filter((r) => r.rollNo || r.studentName);
      setPreview(out);
    } catch (e) {
      setErr((e as Error).message);
    }
  }

  const template = () => {
    const csv = "Roll No,Student Name,Father Name,Parent Phone,MCQ,Subjective,Obtained\n1,Ali Raza,Muhammad Raza,03001234567,10,45,\n";
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = "class-marks-template.csv";
    a.click();
  };

  return (
    <div>
      <div className="row">
        <label className="btn" style={{ margin: 0, color: "#fff" }}>
          📄 Upload .xlsx / .xls / .csv
          <input type="file" hidden accept=".xlsx,.xls,.csv" onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </label>
        <button className="btn-ghost btn-sm" onClick={template}>Download CSV template</button>
        <span className="small muted">Read in your browser — the file is not uploaded.</span>
      </div>
      {err && <div className="alert err" style={{ marginTop: 10 }}>{err}</div>}
      {preview && (
        <div style={{ marginTop: 12 }}>
          <div className="small muted">Detected columns: {mapping}</div>
          <p><b>{preview.length}</b> students found.</p>
          <div className="row">
            <button onClick={() => { onChange(preview); setPreview(null); }}>Replace class list</button>
            <button className="btn-ghost" onClick={() => {
              const byRoll = new Map(rows.map((r) => [r.rollNo, r]));
              preview.forEach((p) => byRoll.set(p.rollNo, { ...(byRoll.get(p.rollNo) ?? {}), ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== "" && v !== null && v !== undefined)) } as ScoreRow));
              onChange([...byRoll.values()]);
              setPreview(null);
            }}>Merge by roll number</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* B) Checked answer-sheet PDF → OMR + OCR                             */
/* ------------------------------------------------------------------ */
interface ScanResult {
  index: number; // student order in PDF
  page: number;
  ok: boolean;
  roll: string;
  rollClear: boolean;
  answers: McqMark[];
  mcq: number;
  correct: number;
  multi: number;
  blank: number;
  subjective: number | null;
  writtenTotal: number | null;
  ocrConf: number;
  thumb: string; // overlay image for verification
  include: boolean;
}

type TessWorker = { recognize: (c: HTMLCanvasElement) => Promise<{ data: { text: string; confidence: number } }>; setParameters: (p: Record<string, string>) => Promise<unknown>; terminate: () => Promise<unknown> };

async function ocrBox(worker: TessWorker, src: HTMLCanvasElement, rect: { x: number; y: number; w: number; h: number }) {
  // Crop, upscale, binarise → cleaner digits for Tesseract
  const scale = Math.max(1, 90 / rect.h);
  const c = document.createElement("canvas");
  c.width = Math.round(rect.w * scale);
  c.height = Math.round(rect.h * scale);
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(src, rect.x, rect.y, rect.w, rect.h, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  let ink = 0;
  for (let i = 0; i < img.data.length; i += 4) {
    const l = 0.299 * img.data[i] + 0.587 * img.data[i + 1] + 0.114 * img.data[i + 2];
    const v = l < 150 ? 0 : 255;
    if (!v) ink++;
    img.data[i] = img.data[i + 1] = img.data[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  if (ink < c.width * c.height * 0.004) return { value: null, conf: 100 }; // empty box
  const { data } = await worker.recognize(c);
  const m = data.text.replace(/\s/g, "").match(/\d+(\.\d+)?/);
  return { value: m ? Number(m[0]) : null, conf: data.confidence };
}

function drawOverlay(canvas: HTMLCanvasElement, corners: Corners | null, read: ReturnType<typeof readSheet> | null, layout: ReturnType<typeof buildOmrLayout>, key: (string | null)[]) {
  const t = document.createElement("canvas");
  const s = 560 / canvas.width;
  t.width = 560;
  t.height = Math.round(canvas.height * s);
  const ctx = t.getContext("2d")!;
  ctx.drawImage(canvas, 0, 0, t.width, t.height);
  if (corners && read) {
    const fw = read.frameWidthPx;
    for (const b of layout.bubbles) {
      const u = b.u, v = b.v;
      const x = ((1 - u) * (1 - v) * corners.tl.x + u * (1 - v) * corners.tr.x + (1 - u) * v * corners.bl.x + u * v * corners.br.x) * s;
      const y = ((1 - u) * (1 - v) * corners.tl.y + u * (1 - v) * corners.tr.y + (1 - u) * v * corners.bl.y + u * v * corners.br.y) * s;
      const f = read.fills[b.key] ?? 0;
      if (f < 0.42) continue;
      let color = "#2563eb";
      if (b.group.startsWith("q-")) {
        const qi = Number(b.group.slice(2)) - 1;
        color = read.answers[qi] === "MULTI" ? "#d97706" : key[qi] === b.value ? "#16a34a" : "#dc2626";
      }
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, b.r * fw * s * 1.4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.fillStyle = "#16a34a";
    [corners.tl, corners.tr, corners.bl, corners.br].forEach((p) => ctx.fillRect(p.x * s - 4, p.y * s - 4, 8, 8));
  }
  return t.toDataURL("image/jpeg", 0.6);
}

function PdfScanner({ paper, rows, onChange }: { paper: PaperDTO; rows: ScoreRow[]; onChange: (r: ScoreRow[]) => void }) {
  const { key, marks, optionCount } = useMemo(() => answerKeyOf(paper), [paper]);
  const layout = useMemo(() => buildOmrLayout(key.length, optionCount), [key.length, optionCount]);
  const [pagesPer, setPagesPer] = useState(1);
  const [omrPage, setOmrPage] = useState(1);
  const [useOcr, setUseOcr] = useState(true);
  const [negative, setNegative] = useState(0);
  const [progress, setProgress] = useState<{ done: number; total: number; msg: string } | null>(null);
  const [results, setResults] = useState<ScanResult[]>([]);
  const [view, setView] = useState<string | null>(null);
  const cancel = useRef(false);
  const missingKey = key.filter((k) => !k).length;

  async function run(file: File) {
    cancel.current = false;
    setResults([]);
    setProgress({ done: 0, total: 0, msg: "Opening PDF…" });
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    const students = Math.floor(doc.numPages / pagesPer);
    let worker: TessWorker | null = null;
    if (useOcr) {
      setProgress({ done: 0, total: students, msg: "Loading free OCR engine (first time ~10 MB)…" });
      const T = await import("tesseract.js");
      worker = (await T.createWorker("eng")) as unknown as TessWorker;
      await worker.setParameters({ tessedit_char_whitelist: "0123456789.", tessedit_pageseg_mode: "7" });
    }
    const out: ScanResult[] = [];
    try {
      for (let sIdx = 0; sIdx < students; sIdx++) {
        if (cancel.current) break;
        const pageNo = sIdx * pagesPer + omrPage;
        setProgress({ done: sIdx, total: students, msg: `Reading sheet ${sIdx + 1} of ${students} (page ${pageNo})…` });
        const page = await doc.getPage(pageNo);
        const vp0 = page.getViewport({ scale: 1 });
        const vp = page.getViewport({ scale: 1300 / vp0.width });
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(vp.width);
        canvas.height = Math.round(vp.height);
        const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport: vp }).promise;
        const g = toGray(ctx.getImageData(0, 0, canvas.width, canvas.height));
        const read = readSheet(g, layout);
        const sc = scoreMcq(read.answers, key, marks, negative);
        let subjective: number | null = null, writtenTotal: number | null = null, ocrConf = 100;
        if (worker && read.corners) {
          const a = await ocrBox(worker, canvas, boxRect(read.corners, layout.marksBox));
          const b = await ocrBox(worker, canvas, boxRect(read.corners, layout.totalBox));
          subjective = a.value;
          writtenTotal = b.value;
          ocrConf = Math.min(a.conf, b.conf);
        }
        out.push({
          index: sIdx, page: pageNo, ok: read.ok, roll: read.roll, rollClear: read.rollClear, answers: read.answers,
          mcq: sc.score, correct: sc.correct, multi: sc.multi, blank: sc.blank, subjective, writtenTotal, ocrConf,
          thumb: drawOverlay(canvas, read.corners, read.ok ? read : null, layout, key), include: true,
        });
        setResults([...out]);
        page.cleanup();
      }
    } finally {
      await worker?.terminate();
      setProgress(null);
    }
  }

  const upd = (i: number, p: Partial<ScanResult>) => setResults((rs) => rs.map((r, j) => (j === i ? { ...r, ...p } : r)));
  const nameOf = (roll: string) => rows.find((r) => r.rollNo === roll)?.studentName ?? "";

  function apply() {
    const byRoll = new Map(rows.map((r) => [r.rollNo, r]));
    results.filter((r) => r.include && r.roll && !r.roll.includes("?")).forEach((r) => {
      const prev = byRoll.get(r.roll) ?? blankRow(r.roll);
      const subj = r.subjective ?? prev.subjectiveObtained ?? null;
      byRoll.set(r.roll, {
        ...prev,
        mcqObtained: r.mcq,
        subjectiveObtained: subj,
        obtained: r.mcq + (subj ?? 0),
        absent: false,
        source: "PDF_OMR",
        breakdown: { omrAnswers: r.answers, correct: r.correct, multi: r.multi, blank: r.blank, page: r.page, writtenTotal: r.writtenTotal },
      });
    });
    onChange([...byRoll.values()].sort((a, b) => (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0) || a.rollNo.localeCompare(b.rollNo)));
  }

  if (!key.length) return <div className="alert">This paper has no Objective (OMR) MCQ section. Use manual entry or Excel upload, or edit the paper and tick “Objective (OMR)” on its MCQ section.</div>;

  return (
    <div>
      <ol className="small muted" style={{ marginTop: 0 }}>
        <li>Print the paper with “OMR bubble sheet” ticked. Students fill bubbles; examiner writes subjective marks (and total) in the boxes on the OMR sheet.</li>
        <li>Scan all checked sheets into <b>one PDF</b> (phone scanner apps like the free Adobe Scan / Google Drive scan work), in any order.</li>
        <li>Upload below. Everything is read inside your browser. Check the table, fix anything flagged, then apply.</li>
      </ol>
      {missingKey > 0 && <div className="alert">{missingKey} MCQ(s) have no correct option set — they will score zero.</div>}
      <div className="row">
        <div style={{ width: 150 }}><label>Pages per student</label><input type="number" min={1} max={20} value={pagesPer} onChange={(e) => setPagesPer(Math.max(1, Number(e.target.value)))} /></div>
        <div style={{ width: 150 }}><label>OMR is page #</label><input type="number" min={1} max={pagesPer} value={omrPage} onChange={(e) => setOmrPage(Math.min(pagesPer, Math.max(1, Number(e.target.value))))} /></div>
        <div style={{ width: 150 }}><label>Negative marking</label><select value={negative} onChange={(e) => setNegative(Number(e.target.value))}><option value={0}>None</option><option value={0.25}>−0.25 per wrong</option><option value={0.33}>−0.33 per wrong</option><option value={0.5}>−0.5 per wrong</option></select></div>
        <label className="check"><input type="checkbox" checked={useOcr} onChange={(e) => setUseOcr(e.target.checked)} /> OCR examiner&apos;s written marks (tesseract.js)</label>
        <label className="btn" style={{ margin: 0, color: "#fff" }}>
          📑 Upload checked sheets PDF
          <input type="file" hidden accept="application/pdf" disabled={!!progress} onChange={(e) => e.target.files?.[0] && run(e.target.files[0])} />
        </label>
      </div>

      {progress && (
        <div className="alert ok" style={{ marginTop: 12 }}>
          {progress.msg}
          {progress.total > 0 && <progress style={{ width: "100%" }} value={progress.done} max={progress.total} />}
          <button className="btn-danger btn-sm" onClick={() => (cancel.current = true)}>Stop</button>
        </div>
      )}

      {results.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <h3>Verification — {results.length} sheet(s)</h3>
          <p className="small muted">Green circle = correct, red = wrong, amber = two bubbles filled (scores zero). Edit any value before applying. Handwriting OCR is a helper — always check the subjective column.</p>
          <div style={{ overflowX: "auto" }}>
            <table className="tbl">
              <thead><tr><th>Use</th><th>Page</th><th>Roll No</th><th>Name (from list)</th><th>MCQ /{marks.reduce((a, b) => a + b, 0)}</th><th>Subjective</th><th>Written total</th><th>Total</th><th>Flags</th><th /></tr></thead>
              <tbody>
                {results.map((r, i) => {
                  const total = r.mcq + (r.subjective ?? 0);
                  const flags = [
                    !r.ok && "markers not found",
                    r.ok && !r.rollClear && "roll unclear",
                    r.roll && !nameOf(r.roll) && rows.length > 0 && "roll not in list",
                    r.multi > 0 && `${r.multi} double-filled`,
                    r.subjective == null && "no subjective marks read",
                    r.writtenTotal != null && Math.abs(r.writtenTotal - total) > 0.01 && `written total ${r.writtenTotal} ≠ ${total}`,
                    r.subjective != null && r.ocrConf < 60 && "low OCR confidence",
                  ].filter(Boolean) as string[];
                  return (
                    <tr key={i} style={{ background: flags.length ? "#fffbeb" : undefined }}>
                      <td><input type="checkbox" checked={r.include} onChange={(e) => upd(i, { include: e.target.checked })} /></td>
                      <td>{r.page}</td>
                      <td style={{ width: 100 }}><input value={r.roll} onChange={(e) => upd(i, { roll: e.target.value.trim(), rollClear: true })} /></td>
                      <td>{nameOf(r.roll) || <span className="muted">—</span>}</td>
                      <td style={{ width: 80 }}><input value={r.mcq} onChange={(e) => upd(i, { mcq: num(e.target.value) ?? 0 })} /></td>
                      <td style={{ width: 90 }}><input value={r.subjective ?? ""} onChange={(e) => upd(i, { subjective: num(e.target.value) })} /></td>
                      <td>{r.writtenTotal ?? "—"}</td>
                      <td><b>{total}</b></td>
                      <td className="small">{flags.map((f) => <span key={f} className="badge warn" style={{ marginRight: 4 }}>{f}</span>)}</td>
                      <td><button className="btn-ghost btn-sm" onClick={() => setView(r.thumb)}>View</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="row" style={{ marginTop: 10 }}>
            <button onClick={apply}>✔ Apply {results.filter((r) => r.include).length} sheets to class result</button>
            <span className="small muted">Rows are matched by roll number; new roll numbers are added.</span>
          </div>
        </div>
      )}

      {view && (
        <div onClick={() => setView(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50 }}>
          <img src={view} alt="scan" style={{ maxHeight: "92vh", maxWidth: "92vw", background: "#fff" }} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Combined component                                                  */
/* ------------------------------------------------------------------ */
export default function CheckedPdfResultCounter({ paper, rows, onRowsChange, totalMarks, omrAllowed = true }: { paper: PaperDTO; rows: ScoreRow[]; onRowsChange: (r: ScoreRow[]) => void; totalMarks: number; omrAllowed?: boolean }) {
  const [tab, setTab] = useState<"manual" | "excel" | "pdf">("manual");
  const hasMcq = answerKeyOf(paper).key.length > 0;
  return (
    <div className="card">
      <div className="tabs">
        <button className={tab === "manual" ? "active" : ""} onClick={() => setTab("manual")}>⌨️ Type marks</button>
        <button className={tab === "excel" ? "active" : ""} onClick={() => setTab("excel")}>📄 Excel / CSV upload</button>
        <button className={tab === "pdf" ? "active" : ""} onClick={() => setTab("pdf")}>📑 Checked sheets PDF (auto-count)</button>
      </div>
      {tab === "manual" && <ManualGrid rows={rows} onChange={onRowsChange} totalMarks={totalMarks} hasMcq={hasMcq} />}
      {tab === "excel" && <ExcelImport rows={rows} onChange={(r) => { onRowsChange(r); setTab("manual"); }} />}
      {tab === "pdf" && !omrAllowed && <div className="alert">OMR auto-count is a Pro feature. <a href="/dashboard/billing">Upgrade</a> — or type marks / upload Excel for free.</div>}
      {tab === "pdf" && omrAllowed && <PdfScanner paper={paper} rows={rows} onChange={(r) => { onRowsChange(r); setTab("manual"); }} />}
    </div>
  );
}
