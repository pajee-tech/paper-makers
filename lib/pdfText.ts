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

/** Renders the page at ~250 DPI on a white canvas and reads it with OCR; noise-only lines are dropped. */
export async function ocrPage(page: PDFPageProxy, worker: OcrWorker): Promise<string> {
  const vp0 = page.getViewport({ scale: 1 });
  const scale = Math.min(2200 / vp0.width, 3200 / vp0.height, 4);
  const vp = page.getViewport({ scale });
  const c = document.createElement("canvas");
  c.width = Math.round(vp.width);
  c.height = Math.round(vp.height);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const { data } = await worker.recognize(c);
  c.width = c.height = 0; // free memory on big books
  return data.text
    .split(/\n+/)
    .map((l) => fixChars(l).replace(/\s+/g, " ").trim())
    // English line with a stray Urdu glyph from the mixed model ("Hard disk(ء") → drop the glyph
    .map((l) => (count(l, LATIN) >= 5 * Math.max(1, count(l, ARABIC)) ? l.replace(/\(?[؀-ۿ]{1,2}\)?(?=\s|$)/g, "").replace(/\s{2,}/g, " ").trim() : l))
    .filter((l) => /[\p{L}\p{N}]/u.test(l) || /_{3,}/.test(l))
    .join("\n");
}

export type OcrMode = "off" | "auto" | "force";
export type PdfProgress = { done: number; total: number; msg: string };
export interface ReadResult { pages: (RawPage & { ocr: boolean })[]; ocrPages: number; emptyPages: number; stopped: boolean; ocrError: string }

/** OCR language for a book: its own language first, the other one second (covers mixed English/Urdu pages). */
export const ocrLangFor = (bookLanguage: string) => (bookLanguage === "ur" ? "urd+eng" : "eng+urd");

/**
 * Reads every page of a PDF file in the browser.
 *  - mode "auto": OCR only pages with no usable text (scanned, InPage Urdu, broken fonts)
 *  - mode "force": OCR every page (mixed Urdu/English books whose text looks fine but reads wrong)
 */
export async function readPdfPages(
  file: File,
  opts: { mode: OcrMode; lang: string; onProgress: (p: PdfProgress) => void; stopped: () => boolean },
): Promise<ReadResult> {
  const pdfjs = await loadPdfJs();
  const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const total = doc.numPages;
  const pages: ReadResult["pages"] = [];
  let worker: OcrWorker | null = null;
  let ocrPages = 0, emptyPages = 0, ocrError = "";
  let stopped = false;
  try {
    for (let n = 1; n <= total; n++) {
      if (opts.stopped()) { stopped = true; break; }
      opts.onProgress({ done: n - 1, total, msg: `Reading page ${n} of ${total}…` });
      const p = await doc.getPage(n);
      let text = await pageText(p);
      let usedOcr = false;
      const q = textQuality(text);
      if (opts.mode === "force" || (opts.mode === "auto" && !q.ok)) {
        try {
          if (!worker) {
            opts.onProgress({ done: n - 1, total, msg: `Loading free OCR engine (${opts.lang.replace("+", " + ").replace("eng", "English").replace("urd", "Urdu")})… first time takes a minute` });
            worker = await createOcr(opts.lang, (f) => opts.onProgress({ done: n - 1 + f, total, msg: `OCR scanning page ${n} of ${total}… ${Math.round(f * 100)}%` }));
          }
          opts.onProgress({ done: n - 1, total, msg: `OCR scanning page ${n} of ${total}…` });
          const read = await ocrPage(p, worker);
          // keep the PDF's own text if OCR found less on a page that was only "suspicious"
          if (opts.mode === "force" || q.reason !== "" || textQuality(read).meaningful >= q.meaningful) { text = read; usedOcr = true; }
        } catch (e) {
          ocrError = (e as Error)?.message || "OCR could not start (check the internet connection)";
          opts.mode = "off"; // don't retry on every page
        }
      }
      if (usedOcr) ocrPages++;
      if (!textQuality(text).ok && textQuality(text).reason === "empty") emptyPages++;
      pages.push({ pageNo: n, text, ocr: usedOcr });
      p.cleanup();
      await new Promise((r) => setTimeout(r, 0)); // keep the page responsive
    }
  } finally {
    await worker?.terminate().catch(() => undefined);
    await doc.destroy().catch(() => undefined);
  }
  return { pages, ocrPages, emptyPages, stopped, ocrError };
}
