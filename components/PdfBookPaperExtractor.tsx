"use client";
/**
 * Textbook PDF → question bank, 100% in the browser (pdfjs-dist). Nothing is uploaded:
 * the PDF stays on the teacher's device; only the questions they save go to the database.
 *
 *  - Renders any page, extracts its text lines, auto-detects numbered questions / MCQ options
 *  - Select lines → turn into MCQ / blank / true-false / short / long drafts
 *  - Drag a box over a diagram, equation or Urdu passage → compressed WebP snippet
 *
 * If you already have your own PdfBookPaperExtractor.tsx, keep it — the rest of the app only
 * needs the `onSave(drafts: DraftQuestion[])` contract below.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import QuestionForm, { cleanDraft, emptyDraft, type DraftQuestion } from "./QuestionForm";
import { canvasToCompressed, loadPdfJs } from "@/lib/clientImage";
import { cleanLine, matchOptionLine, matchQuestionStart, splitInlineOptions } from "@/lib/bookParse";
import { createOcr, ocrPage, pageText, textQuality, type OcrWorker } from "@/lib/pdfText";
import type { QType } from "@/lib/types";

interface Line { text: string; y: number }
interface Rect { x: number; y: number; w: number; h: number }

const Q_START = /^\s*(?:Q\.?\s*)?(?:\d{1,3}|[ivxIVX]{1,5})\s*[.):\-۔]\s+(.+)/;
const OPT_LINE = /^\s*\(?([a-dA-D])\s*[).]\s*(.+)/;

/**
 * Heuristic question detection from a page's text lines (English and Urdu: "۱۔", "(الف)"). Teachers review
 * every draft. MCQ answers are never guessed — the correct option stays empty until the teacher sets it.
 */
export function detectQuestions(lines: string[], defaultMarks = 1): DraftQuestion[] {
  const out: DraftQuestion[] = [];
  let cur: DraftQuestion | null = null;
  const push = () => {
    if (!cur) return;
    if (cur.options && cur.options.filter(Boolean).length >= 3) cur.type = "MCQ";
    else {
      if (cur.options?.length) cur.text += " " + cur.options.map((o, i) => `(${"abcd"[i]}) ${o}`).join(" ");
      cur.options = null;
      cur.correctOption = null;
      if (/_{3,}|\.{4,}|…/.test(cur.text)) {
        cur.type = "FILL_BLANK";
        cur.text = cur.text.replace(/\.{4,}|…+/g, "_____");
      } else if (/\b(true|false)\b/i.test(cur.text) && cur.text.length < 160) cur.type = "TRUE_FALSE";
      else cur.type = cur.text.length > 220 ? "LONG" : "SHORT";
    }
    if (cur.text.trim()) out.push(cur);
    cur = null;
  };
  const join = (a: string, b: string) => (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b) ? a.slice(0, -1) + b : `${a} ${b}`);
  for (const raw of lines) {
    const line = cleanLine(raw);
    if (!line) continue;
    const qm = matchQuestionStart(line);
    const om = matchOptionLine(line);
    if (qm && !(cur && om)) {
      push();
      const inline = splitInlineOptions(qm.text);
      cur = { ...emptyDraft("SHORT"), marks: defaultMarks, text: inline ? inline.stem : qm.text, options: inline?.opts ?? [] };
    } else if (cur && om) {
      const all = splitInlineOptions(line);
      cur.options = [...(cur.options ?? []), ...(all && !all.stem ? all.opts : [om.text])];
    } else if (cur) {
      const inline = splitInlineOptions(line);
      if (inline && (!inline.stem || !(cur.options ?? []).length)) {
        if (inline.stem) cur.text = join(cur.text, inline.stem);
        cur.options = [...(cur.options ?? []), ...inline.opts];
      } else if ((cur.options ?? []).length) cur.options![cur.options!.length - 1] = join(cur.options![cur.options!.length - 1], line);
      else cur.text = join(cur.text, line);
    } else if (lines.length <= 3 || /[?؟]\s*$/.test(line)) {
      // a few selected lines without a printed number (or an unnumbered question) are still one question
      const inline = splitInlineOptions(line);
      cur = { ...emptyDraft("SHORT"), marks: defaultMarks, text: inline ? inline.stem : line, options: inline?.opts ?? [] };
    }
  }
  push();
  return out.map((d) => (d.type === "MCQ" ? { ...d, options: d.options!.slice(0, 5), correctOption: null } : d));
}

export default function PdfBookPaperExtractor({ onSave, disabled }: { onSave: (drafts: DraftQuestion[]) => Promise<void>; disabled?: boolean }) {
  const docRef = useRef<PDFDocumentProxy | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [fileName, setFileName] = useState("");
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [lines, setLines] = useState<Line[]>([]);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [drafts, setDrafts] = useState<DraftQuestion[]>([]);
  const [drag, setDrag] = useState<Rect | null>(null);
  const [start, setStart] = useState<{ x: number; y: number } | null>(null);
  const [crop, setCrop] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const [autoOcr, setAutoOcr] = useState(true);
  const ocrRef = useRef<Promise<OcrWorker> | null>(null);
  const renderSeq = useRef(0);
  useEffect(() => () => { ocrRef.current?.then((w) => w.terminate()).catch(() => undefined); }, []);

  /** Free OCR (English + Urdu) of one page; the engine is loaded once and reused. */
  const runOcr = useCallback(async (n: number) => {
    const doc = docRef.current;
    if (!doc) return;
    const seq = renderSeq.current;
    try {
      if (!ocrRef.current) {
        setStatus("Loading free OCR engine (English + Urdu)… first time takes a minute");
        ocrRef.current = createOcr("eng+urd", (f) => { if (seq === renderSeq.current) setStatus(`OCR scanning page ${n} of ${doc.numPages}… ${Math.round(f * 100)}%`); });
      }
      const w = await ocrRef.current;
      setStatus(`OCR scanning page ${n} of ${doc.numPages}…`);
      const text = await ocrPage(await doc.getPage(n), w);
      if (seq !== renderSeq.current) return; // the teacher moved to another page meanwhile
      const ls = text.split("\n").filter(Boolean).map((t, i) => ({ y: i, text: t }));
      setLines(ls);
      setPicked(new Set());
      setStatus(ls.length ? `Page ${n} read with OCR — check the text before saving.` : "OCR found no text on this page. Drag a box to crop it as an image snippet instead.");
    } catch (e) {
      ocrRef.current = null;
      if (seq === renderSeq.current) setStatus(`OCR could not run: ${(e as Error)?.message || e}. Drag a box to crop the question as an image instead.`);
    }
  }, []);

  const renderPage = useCallback(async (n: number) => {
    const doc = docRef.current;
    const canvas = canvasRef.current;
    if (!doc || !canvas || !wrapRef.current) return;
    setStatus("Rendering page…");
    const p = await doc.getPage(n);
    const base = p.getViewport({ scale: 1 });
    const cssW = Math.min(wrapRef.current.clientWidth || 700, 900);
    const scale = cssW / base.width;
    const dpr = window.devicePixelRatio || 1;
    const vp = p.getViewport({ scale: scale * dpr });
    canvas.width = vp.width;
    canvas.height = vp.height;
    canvas.style.width = `${cssW}px`;
    canvas.style.height = `${vp.height / dpr}px`;
    await p.render({ canvasContext: canvas.getContext("2d")!, viewport: vp }).promise;

    // Text lines (top → bottom); scanned / garbled pages (InPage Urdu) are read with free OCR
    const seq = ++renderSeq.current;
    const text = await pageText(p);
    if (seq !== renderSeq.current) return;
    const ls = text.split("\n").filter(Boolean).map((t, i) => ({ y: i, text: t }));
    const q = textQuality(text);
    setLines(q.ok ? ls : []);
    setPicked(new Set());
    if (q.ok) setStatus("");
    else if (autoOcrRef.current) runOcr(n);
    else setStatus(q.reason === "empty" ? "No selectable text on this page (scanned or Urdu InPage PDF). Press “Force OCR” or drag a box to crop it as an image." : "This page's text is garbled (InPage Urdu / broken font). Press “Force OCR” or drag a box to crop it as an image.");
  }, []);

  const autoOcrRef = useRef(autoOcr);
  autoOcrRef.current = autoOcr;

  useEffect(() => {
    if (numPages) renderPage(page);
  }, [page, numPages, renderPage]);

  async function openFile(f: File) {
    setStatus("Opening PDF in your browser…");
    const pdfjs = await loadPdfJs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()) }).promise;
    docRef.current = doc;
    setFileName(f.name);
    setNumPages(doc.numPages);
    setPage(1);
  }

  /* ---- crop by dragging ---- */
  const pos = (e: React.MouseEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const onDown = (e: React.MouseEvent) => { setStart(pos(e)); setDrag(null); };
  const onMove = (e: React.MouseEvent) => {
    if (!start) return;
    const p = pos(e);
    setDrag({ x: Math.min(start.x, p.x), y: Math.min(start.y, p.y), w: Math.abs(p.x - start.x), h: Math.abs(p.y - start.y) });
  };
  const onUp = async () => {
    setStart(null);
    if (!drag || drag.w < 12 || drag.h < 12 || !docRef.current || !canvasRef.current) return;
    // Re-render the page at high resolution off-screen, then cut the selection.
    const p = await docRef.current.getPage(page);
    const cssW = parseFloat(canvasRef.current.style.width);
    const base = p.getViewport({ scale: 1 });
    const hi = 3;
    const vp = p.getViewport({ scale: (cssW / base.width) * hi });
    const off = document.createElement("canvas");
    off.width = vp.width;
    off.height = vp.height;
    await p.render({ canvasContext: off.getContext("2d")!, viewport: vp }).promise;
    const c = document.createElement("canvas");
    c.width = Math.round(drag.w * hi);
    c.height = Math.round(drag.h * hi);
    c.getContext("2d")!.drawImage(off, drag.x * hi, drag.y * hi, c.width, c.height, 0, 0, c.width, c.height);
    setCrop(canvasToCompressed(c, 900, 0.72));
  };

  const togglePick = (i: number) => setPicked((s) => { const n = new Set(s); n.has(i) ? n.delete(i) : n.add(i); return n; });
  const pickedText = () => [...picked].sort((a, b) => a - b).map((i) => lines[i].text);

  function linesTo(type: QType) {
    const t = pickedText();
    if (!t.length) return;
    let d: DraftQuestion = { ...emptyDraft(type), text: t.join(" ").replace(Q_START, "$1") };
    if (type === "MCQ") {
      const det = detectQuestions(t)[0];
      d = det?.type === "MCQ" ? det : { ...d, options: t.slice(1, 5).map((x) => x.replace(OPT_LINE, "$2")), text: t[0].replace(Q_START, "$1") };
    }
    if (type === "FILL_BLANK" && !/_{3,}/.test(d.text)) d.text += " _____";
    setDrafts((ds) => [...ds, d]);
    setPicked(new Set());
  }

  function applyCrop(mode: "attach" | "new" | "urdu") {
    if (!crop) return;
    if (mode === "attach" && drafts.length) setDrafts((ds) => ds.map((d, i) => (i === ds.length - 1 ? { ...d, imageSnippet: crop } : d)));
    else setDrafts((ds) => [...ds, { ...emptyDraft(mode === "urdu" ? "SHORT" : "SHORT"), text: mode === "urdu" ? "" : "Study the figure and answer:", imageSnippet: crop }]);
    setCrop(null);
    setDrag(null);
  }

  async function save() {
    setSaving(true);
    try {
      await onSave(drafts.map(cleanDraft));
      setDrafts([]);
      setStatus("Saved to the question bank ✔");
    } catch (e) {
      setStatus((e as Error).message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="row">
        <label className="btn" style={{ margin: 0, color: "#fff" }}>
          📘 Open textbook PDF
          <input type="file" accept="application/pdf" hidden onChange={(e) => e.target.files?.[0] && openFile(e.target.files[0])} />
        </label>
        {fileName && <span className="small muted">{fileName} — page {page} / {numPages}</span>}
        <span className="spacer" />
        {numPages > 0 && (
          <>
            <button className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>◀ Prev</button>
            <input style={{ width: 70 }} type="number" min={1} max={numPages} value={page} onChange={(e) => setPage(Math.min(numPages, Math.max(1, Number(e.target.value))))} />
            <button className="btn-ghost btn-sm" disabled={page >= numPages} onClick={() => setPage((p) => p + 1)}>Next ▶</button>
            <label className="check small" title="Pages without readable text (scanned, InPage Urdu) are read automatically with free OCR">
              <input type="checkbox" checked={autoOcr} onChange={(e) => setAutoOcr(e.target.checked)} /> Auto OCR
            </label>
            <button className="btn-ghost btn-sm" title="Read this page as an image with free OCR (English + Urdu)" onClick={() => { renderSeq.current++; runOcr(page); }}>🔍 Force OCR (English + Urdu)</button>
          </>
        )}
      </div>
      <p className="small muted">The PDF never leaves your browser. Drag on the page to crop a diagram, equation or Urdu passage as a compressed image.</p>
      {status && <div className="alert">{status}</div>}

      <div className="grid2" style={{ alignItems: "start" }}>
        <div ref={wrapRef} style={{ position: "relative", userSelect: "none", border: numPages ? "1px solid var(--line)" : undefined }}>
          <canvas ref={canvasRef} onMouseDown={onDown} onMouseMove={onMove} onMouseUp={onUp} onMouseLeave={() => setStart(null)} style={{ cursor: "crosshair", display: numPages ? "block" : "none" }} />
          {drag && <div className="drag-box" style={{ left: drag.x, top: drag.y, width: drag.w, height: drag.h }} />}
        </div>

        <div>
          {crop && (
            <div className="card" style={{ marginBottom: 10 }}>
              <b>Cropped snippet</b> <span className="small muted">({Math.round((crop.length * 0.75) / 1024)} KB)</span>
              <img src={crop} alt="" style={{ maxWidth: "100%", display: "block", margin: "6px 0", border: "1px solid #eee" }} />
              <div className="row">
                <button className="btn-sm" disabled={!drafts.length} onClick={() => applyCrop("attach")}>Attach to last draft</button>
                <button className="btn-sm btn-ghost" onClick={() => applyCrop("new")}>New figure question</button>
                <button className="btn-sm btn-ghost" onClick={() => applyCrop("urdu")}>Urdu / equation snippet</button>
                <button className="btn-sm btn-danger" onClick={() => { setCrop(null); setDrag(null); }}>Discard</button>
              </div>
            </div>
          )}

          {lines.length > 0 && (
            <div className="card">
              <div className="row">
                <b>Page text</b>
                <span className="spacer" />
                <button className="btn-sm" onClick={() => setDrafts((d) => [...d, ...detectQuestions(lines.map((l) => l.text))])}>✨ Auto-detect questions</button>
              </div>
              <div style={{ maxHeight: 260, overflow: "auto", marginTop: 8, fontSize: 13 }}>
                {lines.map((l, i) => (
                  <label key={i} className="check" style={{ alignItems: "flex-start", padding: "2px 0" }}>
                    <input type="checkbox" checked={picked.has(i)} onChange={() => togglePick(i)} /> <span>{l.text}</span>
                  </label>
                ))}
              </div>
              <div className="row" style={{ marginTop: 8, gap: 6 }}>
                <span className="small muted">Selected lines →</span>
                {(["MCQ", "FILL_BLANK", "TRUE_FALSE", "SHORT", "LONG", "CASE_STUDY"] as QType[]).map((t) => (
                  <button key={t} className="btn-ghost btn-sm" disabled={!picked.size} onClick={() => linesTo(t)}>{t.replace("_", " ").toLowerCase()}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {drafts.length > 0 && (
        <div className="card" style={{ marginTop: 14 }}>
          <div className="row">
            <h3 style={{ margin: 0 }}>Drafts ({drafts.length}) — review before saving</h3>
            <span className="spacer" />
            <button className="btn-danger btn-sm" onClick={() => setDrafts([])}>Clear all</button>
            <button disabled={saving || disabled} onClick={save}>{saving ? "Saving…" : `Save ${drafts.length} to chapter`}</button>
          </div>
          {disabled && <p className="small muted">Select a chapter on the left first.</p>}
          {drafts.map((d, i) => (
            <div className="qcard" key={i} style={{ marginTop: 10 }}>
              <div className="row"><b>#{i + 1}</b><span className="spacer" /><button className="btn-danger btn-sm" onClick={() => setDrafts((ds) => ds.filter((_, j) => j !== i))}>Remove</button></div>
              <QuestionForm compact value={d} onChange={(nd) => setDrafts((ds) => ds.map((x, j) => (j === i ? nd : x)))} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
