// Copyright (c) Pajee Technologies. All rights reserved.
/** Test-scope presets: Full Book, 1st/2nd Half, Quarters, Custom chapters, plus Smart Syllabus (ALP) filter. */

export type Scope = "FULL" | "HALF1" | "HALF2" | "Q1" | "Q2" | "Q3" | "Q4" | "CUSTOM";
export type MarksMode = "FULL" | "SCALE";

export const SCOPE_LABEL: Record<Scope, string> = {
  FULL: "Full Book",
  HALF1: "1st Half Book",
  HALF2: "2nd Half Book",
  Q1: "Quarter Book — 1st quarter",
  Q2: "Quarter Book — 2nd quarter",
  Q3: "Quarter Book — 3rd quarter",
  Q4: "Quarter Book — 4th quarter",
  CUSTOM: "Custom — choose chapters yourself",
};

export const SCOPE_TITLE: Record<Scope, string> = {
  FULL: "Full Book Test",
  HALF1: "First Half Book Test",
  HALF2: "Second Half Book Test",
  Q1: "First Quarter Book Test",
  Q2: "Second Quarter Book Test",
  Q3: "Third Quarter Book Test",
  Q4: "Fourth Quarter Book Test",
  CUSTOM: "",
};

/** Chapters (ordered by number) that fall in the chosen scope. */
export function scopeChapters<T extends { number: number; isAlp?: boolean }>(chapters: T[], scope: Scope, alpOnly: boolean): T[] {
  const list = [...chapters].sort((a, b) => a.number - b.number).filter((c) => !alpOnly || c.isAlp);
  const n = list.length;
  const half = Math.ceil(n / 2);
  const q = (k: number) => list.slice(Math.round((n * (k - 1)) / 4), Math.round((n * k) / 4));
  switch (scope) {
    case "FULL": return list;
    case "HALF1": return list.slice(0, half);
    case "HALF2": return list.slice(half);
    case "Q1": return q(1);
    case "Q2": return q(2);
    case "Q3": return q(3);
    case "Q4": return q(4);
    default: return list;
  }
}

/** Proportional factor used when the teacher chooses "scale marks to scope". */
export function scopeFactor(scope: Scope, selected: number, total: number) {
  if (scope === "FULL") return 1;
  if (scope === "HALF1" || scope === "HALF2") return 0.5;
  if (scope.startsWith("Q")) return 0.25;
  return total > 0 && selected > 0 ? Math.min(1, selected / total) : 1;
}

export interface Scalable { questionType: string; count: number; attemptAny?: number | null; base?: { count: number; attemptAny: number | null } }

/** Scales a section's question count and "attempt any" rule from its board-pattern base. */
export function scaleSection<S extends Scalable>(s: S, f: number): S {
  const base = s.base ?? { count: s.count, attemptAny: s.attemptAny ?? null };
  if (f >= 1 || s.questionType === "MATCH_COLUMNS" || s.questionType === "CASE_STUDY") return { ...s, base, count: base.count, attemptAny: base.attemptAny };
  const count = Math.max(1, Math.round(base.count * f));
  let attemptAny = base.attemptAny ? Math.max(1, Math.round(base.attemptAny * f)) : null;
  if (attemptAny && attemptAny >= count) attemptAny = count > 1 ? count - 1 : null;
  return { ...s, base, count, attemptAny };
}
