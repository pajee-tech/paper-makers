"use client";
// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * Reading PDF pages in the browser (free): pdf.js text, and tesseract.js OCR (English + Urdu) for
 * scanned pages or pages whose text is garbled (InPage Urdu, broken fonts). Nothing is uploaded.
 */
import type { PDFPageProxy } from "pdfjs-dist";
import { fixChars, type RawPage } from "./bookParse";
import { loadPdfJs } from "./clientImage";

type TextItem = { str?: string; transform?: number[]; width?: number; height?: number };
const ARABIC = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/g;
const LATIN = /[A-Za-z]/g;
const count = (s: string, re: RegExp) => s.match(re)?.length ?? 0;

/**
 * Text of one PDF page as visual lines (top → bottom). Latin lines read left → right, Urdu lines right → left.
 *  - pieces of one word are joined without a space ("De" + "fi" + "ne" → "Define"); real gaps get one space
 *  - lines are grouped by font height, so superscripts don't split a line in two
 *  - text at a different angle than the page's main text (diagonal "PCTB Not for Sale") is skipped;
 *    a page whose whole text is rotated is still read
 */
export async function pageText(page: PDFPageProxy): Promise<string> {
  const tc = await page.getTextContent();
  const items: { s: string; x: number; y: number; w: number; size: number; angle: number }[] = [];
  for (const it of tc.items as TextItem[]) {
    if (!it.str || !it.str.trim() || !it.transform) continue;
    const [a, b, c, d, e, f] = it.transform;
    const size = Math.hypot(c, d) || Math.hypot(a, b) || it.height || 10;
    items.push({ s: fixChars(it.str), x: e, y: f, w: it.width ?? 0, size, angle: Math.atan2(b, a) });
  }
  if (!items.length) return "";

  // main text direction of the page (weighted by text length)
  const votes = new Map<number, number>();
  for (const it of items) {
    const k = Math.round(it.angle / (Math.PI / 36));
    votes.set(k, (votes.get(k) ?? 0) + it.s.length);
  }
  const mainK = [...votes.entries()].sort((p, q) => q[1] - p[1])[0][0];
  const theta = (mainK * Math.PI) / 36;
  const cos = Math.cos(theta), sin = Math.sin(theta);
  const kept = items
    .filter((it) => Math.abs(Math.atan2(Math.sin(it.angle - theta), Math.cos(it.angle - theta))) < 0.1)
    .map((it) => ({ ...it, x: it.x * cos + it.y * sin, y: -it.x * sin + it.y * cos }))
    .sort((p, q) => q.y - p.y);

  // group into lines
  const rows: { y: number; size: number; parts: typeof kept }[] = [];
  for (const it of kept) {
    const row = rows.find((r) => Math.abs(r.y - it.y) <= Math.max(1.5, 0.45 * Math.min(r.size, it.size)));
    if (row) row.parts.push(it);
    else rows.push({ y: it.y, size: it.size, parts: [it] });
  }
  return rows
    .sort((p, q) => q.y - p.y)
    .map((r) => {
      const all = r.parts.map((p) => p.s).join("");
      const rtl = count(all, ARABIC) > count(all, LATIN);
      const parts = r.parts.sort((p, q) => (rtl ? q.x - p.x : p.x - q.x));
      let out = "";
      parts.forEach((p, i) => {
        if (!i) { out = p.s; return; }
        const prev = parts[i - 1];
        const gap = rtl ? prev.x - (p.x + p.w) : p.x - (prev.x + prev.w);
        const joined = prev.w > 0 && gap < 0.12 * Math.min(prev.size, p.size) && !/\s$/.test(out) && !/^\s/.test(p.s);
        out += joined ? p.s : ` ${p.s}`;
      });
      return out.replace(/\s+/g, " ").trim();
    })
    .filter(Boolean)
    .join("\n");
}

export type TextVerdict = { ok: boolean; reason: "" | "empty" | "garbled"; meaningful: number };
/**
 * Is this page's selectable text usable? "empty" = scanned page (fewer than 30 real letters/digits);
 * "garbled" = broken font encoding (InPage Urdu, symbol soup, Urdu glyphs split one by one).
 */
export function textQuality(text: string): TextVerdict {
  const compact = text.replace(/\s+/g, "");
  const meaningful = count(compact, /[A-Za-z0-9؀-ۿݐ-ݿ]/g);
  if (meaningful < 30) return { ok: false, reason: "empty", meaningful };
  // private-use / replacement / control characters and Latin-1 letters ("ÌÅæ ÒÈÇä" = InPage Urdu read with a wrong font)
  const bad = count(compact, /[-�\u0000-\u0008\u000E-\u001FÀ-ɏ]/g);
  if (bad / compact.length > 0.15) return { ok: false, reason: "garbled", meaningful };
  // dotless letters (ٮ ٯ ڡ) never occur in real Urdu text — they come from a font without a proper Unicode map
  if (count(text, /[ٮٯڡ]/g) >= 3) return { ok: false, reason: "garbled", meaningful };
  // Arabic kaf "ك" inside an Urdu word ("كی", "كر") = Urdu written with a broken font map (real Urdu uses "ک")
  if (text.split(/\s+/).filter((t) => /ك/.test(t) && /[ہیےںٹڈڑگ]/.test(t)).length >= 1 && count(text, /[ٮٯڡك]/g) >= 3) return { ok: false, reason: "garbled", meaningful };
  // Urdu glyphs separated one by one ("ی ﺎ ١ ٮ") or still in presentation forms
  const urTokens = text.split(/\s+/).filter((t) => /[؀-ۿﭐ-﻿]/.test(t));
  if (urTokens.length >= 8) {
    const single = urTokens.filter((t) => [...t.replace(/[^؀-ۿﭐ-﻿]/g, "")].length <= 1).length;
    if (single / urTokens.length > 0.3) return { ok: false, reason: "garbled", meaningful };
    if (count(text, /[ﭐ-﷿ﹰ-﻿]/g) / Math.max(1, count(text, ARABIC)) > 0.3) return { ok: false, reason: "garbled", meaningful };
  }
  // Latin "words" without vowels / symbol soup (a font without a Unicode map)
  const latin = text.match(/[A-Za-z]{3,}/g) ?? [];
  if (latin.length >= 15 && latin.filter((w) => !/[aeiouyAEIOUY]/.test(w)).length / latin.length > 0.5) return { ok: false, reason: "garbled", meaningful };
  const symbols = count(compact, /[^\p{L}\p{M}\p{N}\p{P}\p{S}]/gu) + count(compact, /[!"#$%&'*+\/;<=>@\\^`{|}~]/g);
  if (symbols / compact.length > 0.45) return { ok: false, reason: "garbled", meaningful };
  return { ok: true, reason: "", meaningful };
}

export type OcrWorker = { recognize: (c: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };

/**
 * Free OCR (tesseract.js) — lang: "eng", "urd", "eng+urd" or "urd+eng" (first = main language).
 * The language files (~2–10 MB) download once from the free jsDelivr CDN and are then cached by the browser.
 */
export async function createOcr(lang: string, onProgress?: (fraction: number) => void): Promise<OcrWorker> {
  const T = await import("tesseract.js");
  const worker = await T.createWorker(lang, 1, {
    logger: (m: { status: string; progress: number }) => { if (m.status === "recognizing text") onProgress?.(m.progress); },
  });
  await worker.setParameters({ preserve_interword_spaces: "1" });
  return worker as unknown as OcrWorker;
}

/** How many OCR workers this computer can run side by side (one core is left for the page itself). */
export const ocrWorkerCount = () => Math.max(1, Math.min(4, ((typeof navigator !== "undefined" && navigator.hardwareConcurrency) || 2) - 1));

/**
 * Several OCR workers sharing one queue: pages are read side by side (≈ 2× faster with 2 workers, 3× with 3 …).
 * Workers start one by one, so the first page begins as soon as the first worker is ready.
 */
export async function createOcrPool(lang: string, workers = ocrWorkerCount()) {
  const T = await import("tesseract.js");
  const scheduler = T.createScheduler();
  const first = await T.createWorker(lang, 1);
  await first.setParameters({ preserve_interword_spaces: "1" });
  scheduler.addWorker(first);
  const more = (async () => {
    for (let i = 1; i < workers; i++) {
      const w = await T.createWorker(lang, 1);
      await w.setParameters({ preserve_interword_spaces: "1" });
      scheduler.addWorker(w);
    }
  })().catch(() => undefined); // extra workers are a bonus; one is enough to work
  return {
    size: workers,
    recognize: async (c: HTMLCanvasElement) => (await scheduler.addJob("recognize", c)) as unknown as { data: { text: string } },
    terminate: async () => { await more; await scheduler.terminate(); },
  };
}
export type OcrPool = Awaited<ReturnType<typeof createOcrPool>>;

/** White canvas of the page at `width` px; `topPart` < 1 keeps only the top of the page (where chapter headings are). */
async function renderForOcr(page: PDFPageProxy, width: number, topPart = 1) {
  const vp0 = page.getViewport({ scale: 1 });
  const scale = Math.min(width / vp0.width, 3200 / vp0.height, 4);
  const vp = page.getViewport({ scale });
  const c = document.createElement("canvas");
  c.width = Math.round(vp.width);
  c.height = Math.round(vp.height * topPart);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise; // drawing past the canvas edge is simply cut off
  return c;
}

/** OCR text → clean lines (noise-only lines dropped, stray Urdu glyphs removed from English lines). */
function cleanOcrText(text: string) {
  return text
    .split(/\n+/)
    .map((l) => fixChars(l).replace(/\s+/g, " ").trim())
    // English line with a stray Urdu glyph from the mixed model ("Hard disk(ء") → drop the glyph
    .map((l) => (count(l, LATIN) >= 5 * Math.max(1, count(l, ARABIC)) ? l.replace(/\(?[؀-ۿ]{1,2}\)?(?=\s|$)/g, "").replace(/\s{2,}/g, " ").trim() : l))
    .filter((l) => /[\p{L}\p{N}]/u.test(l) || /_{3,}/.test(l))
    .join("\n");
}

/** Renders the page at ~220 DPI and reads it with OCR (one page, one worker — the question-bank extractor). */
export async function ocrPage(page: PDFPageProxy, worker: OcrWorker | OcrPool): Promise<string> {
  const c = await renderForOcr(page, 1900);
  const { data } = await worker.recognize(c);
  c.width = c.height = 0; // free memory on big books
  return cleanOcrText(data.text);
}

/** "quick" = top 35 % of the page (chapter headings, ~5× faster) · "full" = the whole page. */
export type OcrPart = "quick" | "full";

/**
 * OCR of many pages of an open PDF, as many at a time as the pool has workers.
 * onPage is called as each page finishes (pages may finish out of order).
 */
export async function ocrPdfPages(
  doc: { getPage: (n: number) => Promise<PDFPageProxy> },
  pageNos: number[],
  opts: { pool: OcrPool; part: OcrPart; stopped: () => boolean; onPage: (pageNo: number, text: string, done: number) => void },
) {
  let next = 0, done = 0;
  const lane = async () => {
    while (next < pageNos.length && !opts.stopped()) {
      const n = pageNos[next++];
      const page = await doc.getPage(n);
      const c = await renderForOcr(page, 1900, opts.part === "quick" ? 0.35 : 1);
      page.cleanup();
      const { data } = await opts.pool.recognize(c);
      c.width = c.height = 0;
      opts.onPage(n, cleanOcrText(data.text), ++done);
      await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(opts.pool.size, pageNos.length)) }, lane));
}

/**
 * "off" = PDF text only · "smart" = PDF text + a quick heading scan of scanned pages (chapters are found in minutes,
 * questions are then read chapter by chapter in Book Library) · "all" = full OCR of every scanned page now (slow).
 * Old names: "auto" = "all", "force" = "all" for every page.
 */
export type OcrMode = "off" | "smart" | "all" | "auto" | "force";
export type PdfProgress = { done: number; total: number; msg: string };
export type ReadPage = RawPage & { ocr: boolean; ocrLevel: 0 | 1 | 2 };
export interface ReadResult { pages: ReadPage[]; ocrPages: number; quickPages: number; emptyPages: number; stopped: boolean; ocrError: string }

/** OCR language: the book's own language only (≈ 2× faster); "mixed" adds the other one for English + Urdu books. */
export const ocrLangFor = (bookLanguage: string, mixed = false) => (bookLanguage === "ur" ? (mixed ? "urd+eng" : "urd") : mixed ? "eng+urd" : "eng");
const langName = (lang: string) => lang.split("+").map((l) => (l === "urd" ? "Urdu" : "English")).join(" + ");

/** Reads every page of a PDF file in the browser (see OcrMode). `everyPage` treats every page as scanned. */
export async function readPdfPages(
  file: File,
  opts: { mode: OcrMode; lang: string; everyPage?: boolean; onProgress: (p: PdfProgress) => void; stopped: () => boolean },
): Promise<ReadResult> {
  const mode = opts.mode === "auto" || opts.mode === "force" ? "all" : opts.mode;
  const everyPage = opts.everyPage || opts.mode === "force";
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const total = doc.numPages;
  const pages: ReadPage[] = [];
  const need: number[] = [];
  let ocrPages = 0, quickPages = 0, ocrError = "";
  let stopped = false;
  try {
    // 1. the PDF's own text — a second or two for the whole book
    for (let n = 1; n <= total; n++) {
      if (opts.stopped()) { stopped = true; break; }
      if (n % 10 === 1) opts.onProgress({ done: n - 1, total, msg: `Reading page ${n} of ${total}…` });
      const p = await doc.getPage(n);
      const text = await pageText(p);
      p.cleanup();
      pages.push({ pageNo: n, text, ocr: false, ocrLevel: 0 });
      if (mode !== "off" && (everyPage || !textQuality(text).ok)) need.push(n);
      if (n % 20 === 0) await new Promise((r) => setTimeout(r, 0));
    }
    // 2. OCR of scanned / garbled pages, several at a time
    if (need.length && !stopped) {
      const part: OcrPart = mode === "smart" ? "quick" : "full";
      let pool: OcrPool | null = null;
      try {
        opts.onProgress({ done: 0, total: need.length, msg: `Loading free OCR engine (${langName(opts.lang)}, ${ocrWorkerCount()} at a time)… first time takes a minute` });
        pool = await createOcrPool(opts.lang);
        const t0 = Date.now();
        await ocrPdfPages(doc, need, {
          pool, part, stopped: opts.stopped,
          onPage: (n, text, done) => {
            const pg = pages[n - 1];
            const before = textQuality(pg.text);
            // keep the PDF's own text when OCR found less on a page that only looked suspicious
            if (everyPage || !before.ok || textQuality(text).meaningful >= before.meaningful) {
              pages[n - 1] = { pageNo: n, text, ocr: true, ocrLevel: part === "quick" ? 1 : 2 };
              if (part === "quick") quickPages++; else ocrPages++;
            }
            const left = Math.round(((Date.now() - t0) / done) * (need.length - done) / 1000);
            opts.onProgress({ done, total: need.length, msg: `${part === "quick" ? "Finding chapters — quick scan of" : "OCR scanning"} page ${done} of ${need.length}${done >= 3 ? ` · about ${left < 90 ? `${left} s` : `${Math.round(left / 60)} min`} left` : ""}…` });
          },
        });
        if (opts.stopped()) stopped = true;
      } catch (e) {
        ocrError = (e as Error)?.message || "OCR could not start (check the internet connection)";
      } finally {
        await pool?.terminate().catch(() => undefined);
      }
    }
  } finally {
    await doc.destroy().catch(() => undefined);
  }
  const emptyPages = pages.filter((p) => p.ocrLevel !== 1 && textQuality(p.text).reason === "empty").length;
  return { pages, ocrPages, quickPages, emptyPages, stopped, ocrError };
}

/** Opens a PDF file for chapter-by-chapter OCR (Book Library). */
export async function openPdf(file: Blob) {
  const pdfjs = await loadPdfJs();
  return pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
}
