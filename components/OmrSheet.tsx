"use client";
import { buildOmrLayout, MARKER_FRAC, OMR_ASPECT } from "@/lib/omrLayout";

interface Props {
  mcqCount: number;
  optionCount?: number;
  widthMm: number; // total printed width incl. markers
  maxHeightMm?: number;
  institution: string;
  title: string;
  className?: string | null;
  subjectName?: string | null;
}

/** Printable OMR bubble sheet. Geometry comes from lib/omrLayout so the scanner can read it back. */
export default function OmrSheet({ mcqCount, optionCount = 4, widthMm, maxHeightMm, institution, title, className, subjectName }: Props) {
  const L = buildOmrLayout(mcqCount, optionCount);
  let fw = widthMm / (1 + MARKER_FRAC);
  if (maxHeightMm) fw = Math.min(fw, (maxHeightMm - fw * MARKER_FRAC) * OMR_ASPECT);
  const fh = fw / OMR_ASPECT;
  const m = fw * MARKER_FRAC;
  const mm = (v: number) => `${v}mm`;
  const at = (u: number, v: number) => ({ left: mm(u * fw), top: mm(v * fh) });
  const box = (b: { u: number; v: number; w: number; h: number }) => ({ left: mm(b.u * fw), top: mm(b.v * fh), width: mm(b.w * fw), height: mm(b.h * fh) });
  const rPx = L.bubbles[0]?.r ?? 0.0135;
  const d = rPx * 2 * fw;

  return (
    <div className="omr" style={{ width: mm(fw + m), height: mm(fh + m) }}>
      <div className="frame" style={{ left: mm(m / 2), top: mm(m / 2), width: mm(fw), height: mm(fh) }}>
        {[[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => (
          <div key={`${u}${v}`} className="mk" style={{ ...at(u, v), width: mm(m), height: mm(m) }} />
        ))}

        <div style={{ position: "absolute", left: mm(0.04 * fw), top: mm(0.025 * fh), width: mm(0.92 * fw), textAlign: "center" }}>
          <div style={{ fontWeight: 800, fontSize: "4mm", textTransform: "uppercase" }}>{institution}</div>
          <div style={{ fontSize: "3.2mm", fontWeight: 700 }}>OMR Answer Sheet — {title}</div>
          <div style={{ fontSize: "2.8mm" }}>{[className, subjectName].filter(Boolean).join(" • ")}</div>
          <div style={{ fontSize: "2.8mm", marginTop: "1.5mm", display: "flex", gap: "4mm" }}>
            <span style={{ flex: 2, borderBottom: "0.25mm solid #000", textAlign: "left" }}>Name:</span>
            <span style={{ flex: 1, borderBottom: "0.25mm solid #000", textAlign: "left" }}>Section:</span>
          </div>
        </div>

        <div className="boxlbl" style={{ left: mm(L.rollBox.u * fw), top: mm(L.rollBox.v * fh) }}>Roll No. (write & fill bubbles)</div>
        <div className="box" style={box(L.rollBox)}>
          {Array.from({ length: L.rollDigits - 1 }, (_, i) => (
            <div key={i} style={{ position: "absolute", top: 0, bottom: 0, left: `${((i + 1) / L.rollDigits) * 100}%`, borderLeft: "0.2mm solid #999" }} />
          ))}
        </div>

        <div className="boxlbl" style={{ left: mm(L.marksBox.u * fw), top: mm(L.marksBox.v * fh) }}>Subjective Marks (examiner — write digits)</div>
        <div className="box" style={box(L.marksBox)} />
        <div className="boxlbl" style={{ left: mm(L.totalBox.u * fw), top: mm(L.totalBox.v * fh) }}>Grand Total (examiner)</div>
        <div className="box" style={box(L.totalBox)} />
        <div style={{ position: "absolute", left: mm(0.56 * fw), top: mm(0.435 * fh), width: mm(0.38 * fw), fontSize: "2.5mm", lineHeight: 1.35 }}>
          Fill one bubble completely with a dark pen: ● &nbsp;Do not tick ✓ or cross ✗. Overwriting or filling two bubbles cancels the answer.
        </div>

        <div className="lbl" style={{ ...at(0.03, 0.495), fontSize: "3mm", fontWeight: 700 }}>Part-I Objective — {mcqCount} MCQs</div>

        {L.bubbles.map((b) => (
          <div key={b.key} className="bub" style={{ ...at(b.u, b.v), width: mm(d), height: mm(d), fontSize: mm(d * 0.55) }}>
            {b.value}
          </div>
        ))}

        {Array.from({ length: mcqCount }, (_, q) => {
          const col = Math.floor(q / L.mcqArea.perCol);
          const row = q % L.mcqArea.perCol;
          return (
            <div key={q} className="lbl" style={{ ...at(L.mcqArea.u + col * L.mcqArea.colW + 0.005, L.mcqArea.v + row * L.mcqArea.rowH + L.mcqArea.rowH / 2), fontSize: "2.8mm", fontWeight: 700 }}>
              {q + 1}.
            </div>
          );
        })}
      </div>
    </div>
  );
}
