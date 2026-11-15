/**
 * Pure, dependency-free OMR reader (runs in the browser on canvas pixels; also unit-testable in Node).
 *  1. Binarise the page, find solid square blobs → the 4 corner markers.
 *  2. Map the normalised layout (lib/omrLayout) onto the page with a bilinear transform
 *     (tolerates small rotation, skew and scaling from scanners/phone scans).
 *  3. Measure the ink darkness inside every bubble and decide answers / roll number.
 */
import { buildOmrLayout, OMR_ASPECT, type OmrLayout } from "./omrLayout";

export interface Gray { w: number; h: number; d: Float32Array } // darkness 0 (white) … 1 (black)
export interface Pt { x: number; y: number }
export interface Corners { tl: Pt; tr: Pt; bl: Pt; br: Pt }

export function toGray(img: { width: number; height: number; data: Uint8ClampedArray }): Gray {
  const { width: w, height: h, data } = img;
  const d = new Float32Array(w * h);
  for (let i = 0, p = 0; i < d.length; i++, p += 4) d[i] = 1 - (0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2]) / 255;
  return { w, h, d };
}

interface Blob { x: number; y: number; w: number; h: number; area: number; fill: number }

/** Connected components of dark pixels that look like solid squares. */
export function findSquareBlobs(g: Gray, thr = 0.5): Blob[] {
  const { w, h, d } = g;
  const seen = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  const minSide = Math.max(6, Math.round(Math.min(w, h * OMR_ASPECT) * 0.018));
  const maxSide = Math.round(w * 0.08);
  const out: Blob[] = [];
  for (let i = 0; i < w * h; i++) {
    if (seen[i] || d[i] < thr) continue;
    let sp = 0;
    stack[sp++] = i;
    seen[i] = 1;
    let area = 0, sx = 0, sy = 0, minX = w, maxX = 0, minY = h, maxY = 0;
    while (sp) {
      const k = stack[--sp];
      const x = k % w, y = (k / w) | 0;
      area++; sx += x; sy += y;
      if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y;
      const nb = [k - 1, k + 1, k - w, k + w];
      for (let n = 0; n < 4; n++) {
        const j = nb[n];
        if (j < 0 || j >= w * h || seen[j] || d[j] < thr) continue;
        if ((n === 0 && x === 0) || (n === 1 && x === w - 1)) continue;
        seen[j] = 1;
        stack[sp++] = j;
      }
    }
    const bw = maxX - minX + 1, bh = maxY - minY + 1;
    if (bw < minSide || bh < minSide || bw > maxSide || bh > maxSide) continue;
    const aspect = bw / bh;
    const fill = area / (bw * bh);
    if (aspect < 0.7 || aspect > 1.43 || fill < 0.86) continue; // circles fill ≈ 0.785 → rejected
    out.push({ x: sx / area, y: sy / area, w: bw, h: bh, area, fill });
  }
  return out;
}

export function findMarkers(g: Gray): Corners | null {
  const blobs = findSquareBlobs(g);
  if (blobs.length < 4) return null;
  // Markers are similar in size: keep blobs near the median of the largest ones.
  const sorted = [...blobs].sort((a, b) => b.area - a.area).slice(0, 12);
  const ref = sorted[Math.min(3, sorted.length - 1)].area;
  const c = sorted.filter((b) => b.area > ref * 0.5 && b.area < ref * 2.2);
  if (c.length < 4) return null;
  const pick = (f: (b: Blob) => number) => c.reduce((m, b) => (f(b) > f(m) ? b : m));
  const tl = pick((b) => -(b.x + b.y));
  const br = pick((b) => b.x + b.y);
  const tr = pick((b) => b.x - b.y);
  const bl = pick((b) => b.y - b.x);
  const corners = { tl, tr, bl, br };
  if (new Set([tl, tr, bl, br]).size < 4) return null;
  // Geometry sanity check: frame aspect ≈ OMR_ASPECT
  const wTop = Math.hypot(tr.x - tl.x, tr.y - tl.y);
  const hLeft = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const ratio = wTop / hLeft;
  if (Math.abs(ratio - OMR_ASPECT) > 0.12) return null;
  return { tl: { x: corners.tl.x, y: corners.tl.y }, tr: { x: tr.x, y: tr.y }, bl: { x: bl.x, y: bl.y }, br: { x: br.x, y: br.y } };
}

export function mapUV(c: Corners, u: number, v: number): Pt {
  return {
    x: (1 - u) * (1 - v) * c.tl.x + u * (1 - v) * c.tr.x + (1 - u) * v * c.bl.x + u * v * c.br.x,
    y: (1 - u) * (1 - v) * c.tl.y + u * (1 - v) * c.tr.y + (1 - u) * v * c.bl.y + u * v * c.br.y,
  };
}

export function sampleDisk(g: Gray, cx: number, cy: number, r: number): number {
  let s = 0, n = 0;
  const r2 = r * r;
  for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++) {
    if (y < 0 || y >= g.h) continue;
    for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
      if (x < 0 || x >= g.w) continue;
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy > r2) continue;
      s += g.d[y * g.w + x];
      n++;
    }
  }
  return n ? s / n : 0;
}

export type McqMark = string | null | "MULTI"; // "A".."E", blank, or more than one filled

export interface SheetRead {
  ok: boolean;
  corners: Corners | null;
  roll: string; // "?" for unreadable digits
  rollClear: boolean;
  answers: McqMark[]; // index 0 = Q1
  fills: Record<string, number>;
  frameWidthPx: number;
}

export const FILL_THRESHOLD = 0.42;

function decide(values: { value: string; f: number }[]): McqMark {
  const filled = values.filter((v) => v.f >= FILL_THRESHOLD).sort((a, b) => b.f - a.f);
  if (!filled.length) return null;
  if (filled.length > 1 && filled[1].f > filled[0].f * 0.7) return "MULTI";
  return filled[0].value;
}

export function readSheet(g: Gray, layout: OmrLayout): SheetRead {
  const corners = findMarkers(g);
  const empty: SheetRead = { ok: false, corners: null, roll: "", rollClear: false, answers: Array(layout.mcqCount).fill(null), fills: {}, frameWidthPx: 0 };
  if (!corners) return empty;
  const fw = Math.hypot(corners.tr.x - corners.tl.x, corners.tr.y - corners.tl.y);
  const fills: Record<string, number> = {};
  const groups = new Map<string, { value: string; f: number }[]>();
  for (const b of layout.bubbles) {
    const p = mapUV(corners, b.u, b.v);
    const f = sampleDisk(g, p.x, p.y, b.r * fw * 0.62);
    fills[b.key] = f;
    const arr = groups.get(b.group) ?? [];
    arr.push({ value: b.value, f });
    groups.set(b.group, arr);
  }
  let roll = "";
  let rollClear = true;
  for (let c = 0; c < layout.rollDigits; c++) {
    const m = decide(groups.get(`roll-${c}`) ?? []);
    if (m === null) continue; // unused leading/trailing column
    if (m === "MULTI") { roll += "?"; rollClear = false; } else roll += m;
  }
  if (!roll) rollClear = false;
  const answers: McqMark[] = [];
  for (let q = 1; q <= layout.mcqCount; q++) answers.push(decide(groups.get(`q-${q}`) ?? []));
  return { ok: true, corners, roll, rollClear, answers, fills, frameWidthPx: fw };
}

/** BISE rule: blank and multiple-filled answers score zero (no negative marking by default). */
export function scoreMcq(answers: McqMark[], key: (string | null)[], marks: number[], negative = 0) {
  let correct = 0, wrong = 0, blank = 0, multi = 0, score = 0;
  key.forEach((k, i) => {
    const a = answers[i];
    if (a === null || a === undefined) blank++;
    else if (a === "MULTI") multi++;
    else if (k && a === k) { correct++; score += marks[i] ?? 1; }
    else { wrong++; score -= negative * (marks[i] ?? 1); }
  });
  return { correct, wrong, blank, multi, score: Math.max(0, Math.round(score * 100) / 100) };
}

/** Axis-aligned pixel rectangle of a layout box (for OCR crops). */
export function boxRect(c: Corners, b: { u: number; v: number; w: number; h: number }, inset = 0.08) {
  const iu = b.w * inset, iv = b.h * inset * 1.5;
  const pts = [mapUV(c, b.u + iu, b.v + iv), mapUV(c, b.u + b.w - iu, b.v + iv), mapUV(c, b.u + iu, b.v + b.h - iv), mapUV(c, b.u + b.w - iu, b.v + b.h - iv)];
  const x = Math.min(...pts.map((p) => p.x)), y = Math.min(...pts.map((p) => p.y));
  return { x, y, w: Math.max(...pts.map((p) => p.x)) - x, h: Math.max(...pts.map((p) => p.y)) - y };
}

export { buildOmrLayout };
