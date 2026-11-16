import type { GradeBand, ScoreRow } from "./types";

// Common Pakistani school/board-style bands. Editable per result session.
export const DEFAULT_GRADES: GradeBand[] = [
  { grade: "A+", min: 80 },
  { grade: "A", min: 70 },
  { grade: "B", min: 60 },
  { grade: "C", min: 50 },
  { grade: "D", min: 40 },
  { grade: "E", min: 33 },
  { grade: "F", min: 0 },
];

const round2 = (n: number) => Math.round(n * 100) / 100;

export function gradeFor(pct: number, scheme: GradeBand[] = DEFAULT_GRADES) {
  const sorted = [...scheme].sort((a, b) => b.min - a.min);
  return sorted.find((b) => pct >= b.min)?.grade ?? "F";
}

/**
 * Calculates percentage, grade, pass/fail and class positions.
 * Ties share a position (competition ranking: 1, 1, 3). Absent students get no position.
 */
export function computeResults(rows: ScoreRow[], totalMarks: number, passPercent = 33, scheme: GradeBand[] = DEFAULT_GRADES): ScoreRow[] {
  const out = rows.map((r) => {
    const obtained = r.absent ? 0 : Math.max(0, Math.min(totalMarks, Number(r.obtained) || 0));
    const percentage = totalMarks > 0 ? round2((obtained / totalMarks) * 100) : 0;
    const passed = !r.absent && percentage >= passPercent;
    return { ...r, obtained, percentage, passed, grade: r.absent ? "Absent" : passed ? gradeFor(percentage, scheme) : "F", position: null as number | null };
  });
  const present = out.filter((r) => !r.absent).sort((a, b) => b.obtained - a.obtained);
  let lastScore = Number.NaN;
  let lastPos = 0;
  present.forEach((r, i) => {
    if (r.obtained !== lastScore) {
      lastPos = i + 1;
      lastScore = r.obtained;
    }
    r.position = lastPos;
  });
  return out;
}

export function ordinal(n?: number | null) {
  if (!n) return "—";
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

export function classSummary(rows: ScoreRow[]) {
  const present = rows.filter((r) => !r.absent);
  const passed = present.filter((r) => r.passed).length;
  const avg = present.length ? round2(present.reduce((a, r) => a + (r.percentage ?? 0), 0) / present.length) : 0;
  const highest = present.reduce((m, r) => Math.max(m, r.obtained), 0);
  return {
    total: rows.length,
    present: present.length,
    absent: rows.length - present.length,
    passed,
    failed: present.length - passed,
    passRate: present.length ? round2((passed / present.length) * 100) : 0,
    average: avg,
    highest,
  };
}

/** Pakistani mobile → wa.me international format. 0300-1234567 → 923001234567 */
export function toWhatsAppNumber(phone?: string | null) {
  if (!phone) return null;
  let d = phone.replace(/\D/g, "");
  if (d.startsWith("0092")) d = d.slice(2);
  if (d.startsWith("03") && d.length === 11) d = "92" + d.slice(1);
  if (d.startsWith("3") && d.length === 10) d = "92" + d;
  return d.length >= 11 ? d : null;
}

export function whatsappLink(phone: string | null | undefined, message: string) {
  const n = toWhatsAppNumber(phone);
  return n ? `https://wa.me/${n}?text=${encodeURIComponent(message)}` : null;
}
