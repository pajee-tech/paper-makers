import type { PaperSize, PrintSettings } from "./types";

export interface SizeSpec {
  label: string;
  hint: string;
  w: number; // mm, portrait
  h: number;
  /** For 2-up: the physical sheet the printer uses, and each copy is (w × h). */
  sheet?: { w: number; h: number };
}

export const PAPER_SIZES: Record<PaperSize, SizeSpec> = {
  A4: { label: "A4 (210 × 297 mm · 8.27 × 11.69 in)", hint: "Standard school/college exam size", w: 210, h: 297 },
  LEGAL: { label: "Legal (216 × 356 mm · 8.5 × 14 in)", hint: "Ideal for full board-pattern papers & date sheets", w: 216, h: 356 },
  LETTER: { label: "Letter (216 × 279 mm · 8.5 × 11 in)", hint: "Office / academy printers", w: 216, h: 279 },
  A5_2UP: {
    label: "A5 Half-Page, 2-up (148 × 210 mm)",
    hint: "Weekly/daily quizzes — 2 identical tests per A4 sheet",
    w: 148,
    h: 210,
    sheet: { w: 297, h: 210 }, // A4 landscape holds two A5 portrait copies side by side
  },
  FOLIO: { label: "Folio / Foolscap (216 × 330 mm)", hint: "Common local photocopy/exam sheet", w: 216, h: 330 },
};

export const DEFAULT_PRINT: PrintSettings = {
  size: "A4",
  orientation: "portrait",
  columns: 1,
  fontSize: 11,
  showKey: false,
  showOmr: true,
  marginMm: 12,
};

/** Dimensions of one paper copy (what the content is laid out in). */
export function copyDims(s: PrintSettings) {
  const spec = PAPER_SIZES[s.size];
  if (s.size === "A5_2UP") return { w: spec.w, h: spec.h }; // 2-up copies stay portrait
  return s.orientation === "landscape" ? { w: spec.h, h: spec.w } : { w: spec.w, h: spec.h };
}

/** Dimensions passed to @page (physical sheet). */
export function sheetDims(s: PrintSettings) {
  const spec = PAPER_SIZES[s.size];
  if (spec.sheet) return spec.sheet;
  return copyDims(s);
}

/** The dynamic @page rule injected into the document before printing. */
export function pageCss(s: PrintSettings) {
  const { w, h } = sheetDims(s);
  const margin = s.size === "A5_2UP" ? 0 : s.marginMm;
  const spec = PAPER_SIZES[s.size];
  // Named page: the OMR sheet always prints portrait (even when the paper is landscape)
  // so its geometry matches what the scanner expects.
  return `@page { size: ${w}mm ${h}mm; margin: ${margin}mm; } @page omr { size: ${spec.w}mm ${spec.h}mm; margin: ${s.marginMm}mm; }`;
}

/** Printable area of the portrait OMR page. */
export function omrInner(s: PrintSettings) {
  const spec = PAPER_SIZES[s.size];
  return { w: spec.w - 2 * s.marginMm, h: spec.h - 2 * s.marginMm };
}
