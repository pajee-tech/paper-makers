"use client";
// Copyright (c) Pajee Technologies. All rights reserved.
import type { PDFPageProxy } from "pdfjs-dist";

/** Text of one PDF page as visual lines (top → bottom, left → right; RTL lines stay as extracted). */
export async function pageText(page: PDFPageProxy): Promise<string> {
  const tc = await page.getTextContent();
  const rows = new Map<number, { x: number; s: string }[]>();
  for (const it of tc.items as { str?: string; transform?: number[] }[]) {
    if (!it.str || !it.str.trim() || !it.transform) continue;
    // rotated text = side/diagonal watermarks ("PCTB Not for Sale") — never part of a question
    const [a, b] = it.transform;
    if (Math.abs(b) > Math.abs(a) * 0.2) continue;
    const y = Math.round(it.transform[5] / 3) * 3;
    const arr = rows.get(y) ?? [];
    arr.push({ x: it.transform[4], s: it.str });
    rows.set(y, arr);
  }
  return [...rows.entries()]
    .sort((a, b) => b[0] - a[0])
    .map(([, parts]) => parts.sort((a, b) => a.x - b.x).map((p) => p.s).join(" ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join("\n");
}

type OcrWorker = { recognize: (c: HTMLCanvasElement) => Promise<{ data: { text: string } }>; terminate: () => Promise<unknown> };

/** Free OCR for scanned pages (tesseract.js). lang: "eng", "urd" or "eng+urd". */
export async function createOcr(lang: string): Promise<OcrWorker> {
  const T = await import("tesseract.js");
  return (await T.createWorker(lang)) as unknown as OcrWorker;
}

export async function ocrPage(page: PDFPageProxy, worker: OcrWorker): Promise<string> {
  const vp0 = page.getViewport({ scale: 1 });
  const vp = page.getViewport({ scale: 1800 / vp0.width });
  const c = document.createElement("canvas");
  c.width = Math.round(vp.width);
  c.height = Math.round(vp.height);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  await page.render({ canvasContext: ctx, viewport: vp }).promise;
  const { data } = await worker.recognize(c);
  return data.text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean).join("\n");
}
