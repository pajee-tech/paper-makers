/**
 * Single source of truth for the OMR bubble sheet geometry.
 * The printed sheet (OmrSheet.tsx) and the scanner (CheckedPdfResultCounter.tsx)
 * both use these normalized coordinates, so detection never drifts from the print.
 *
 * Coordinate frame: (u, v) in [0,1] measured between the CENTRES of the four
 * black corner markers. u → right, v → down. Radius r is a fraction of frame width.
 */

export const OMR_ASPECT = 0.72; // frame width / frame height
export const MARKER_FRAC = 0.035; // marker side as a fraction of frame width
export const OPTION_LETTERS = ["A", "B", "C", "D", "E"];

export interface Bubble {
  key: string; // "roll-2-7" (digit col 2, value 7) or "q-5-B"
  u: number;
  v: number;
  r: number;
  group: string; // "roll-2" or "q-5"
  value: string; // "7" or "B"
}

export interface OmrLayout {
  bubbles: Bubble[];
  mcqCount: number;
  optionCount: number;
  rollDigits: number;
  rollBox: { u: number; v: number; w: number; h: number }; // handwritten roll no box
  marksBox: { u: number; v: number; w: number; h: number }; // teacher writes subjective total here (OCR)
  totalBox: { u: number; v: number; w: number; h: number };
  rollGrid: { u: number; v: number; colW: number; rowH: number };
  mcqArea: { u: number; v: number; colW: number; rowH: number; perCol: number; cols: number };
}

export function buildOmrLayout(mcqCount: number, optionCount = 4, rollDigits = 6): OmrLayout {
  const bubbles: Bubble[] = [];
  const r = 0.0135;

  // Roll number grid: digit columns × 10 rows (0–9)
  const rollGrid = { u: 0.06, v: 0.2, colW: 0.05, rowH: 0.026 };
  for (let c = 0; c < rollDigits; c++) {
    for (let d = 0; d < 10; d++) {
      bubbles.push({
        key: `roll-${c}-${d}`,
        group: `roll-${c}`,
        value: String(d),
        u: rollGrid.u + c * rollGrid.colW + rollGrid.colW / 2,
        v: rollGrid.v + d * rollGrid.rowH + rollGrid.rowH / 2,
        r,
      });
    }
  }

  // MCQ area: up to 4 columns, 15 rows each (60 MCQs max)
  const cols = Math.min(4, Math.max(1, Math.ceil(mcqCount / 15)));
  const perCol = Math.ceil(mcqCount / cols) || 1;
  const mcqArea = { u: 0.03, v: 0.52, colW: 0.94 / cols, rowH: Math.min(0.03, 0.46 / perCol), perCol, cols };
  const optStep = Math.min(0.05, (mcqArea.colW - 0.07) / optionCount);
  for (let q = 0; q < mcqCount; q++) {
    const col = Math.floor(q / perCol);
    const row = q % perCol;
    for (let o = 0; o < optionCount; o++) {
      bubbles.push({
        key: `q-${q + 1}-${OPTION_LETTERS[o]}`,
        group: `q-${q + 1}`,
        value: OPTION_LETTERS[o],
        u: mcqArea.u + col * mcqArea.colW + 0.075 + o * optStep + optStep / 2,
        v: mcqArea.v + row * mcqArea.rowH + mcqArea.rowH / 2,
        r,
      });
    }
  }

  return {
    bubbles,
    mcqCount,
    optionCount,
    rollDigits,
    rollGrid,
    mcqArea,
    rollBox: { u: rollGrid.u, v: 0.145, w: rollDigits * rollGrid.colW, h: 0.045 },
    marksBox: { u: 0.56, v: 0.2, w: 0.38, h: 0.085 },
    totalBox: { u: 0.56, v: 0.33, w: 0.38, h: 0.085 },
  };
}
