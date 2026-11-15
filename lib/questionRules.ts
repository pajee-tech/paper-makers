// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * Strict question-type rules, shared by the builder (pools), the API (save) and the print renderer:
 *   MCQ section   → only MCQ questions that have options
 *   SHORT section → only SHORT questions, never options
 *   LONG section  → only LONG questions, never options
 *   any other     → only questions of exactly that type
 */
import type { PaperSection, QType, QuestionSnapshot } from "./types";
import { stripWatermarks } from "./bookParse";

export function fitsSection(qType: QType, sectionType: QType) {
  return qType === sectionType;
}

/** Shapes one question for the section it sits in (options are stripped outside MCQ sections). */
export function normalizeForSection<T extends Partial<QuestionSnapshot> & { type: QType }>(q: T, sectionType: QType): T {
  // book watermarks ("PCTB Not for Sale") never print, also on papers saved before the reader removed them
  const clean = { ...q, text: typeof q.text === "string" ? stripWatermarks(q.text) : q.text };
  if (sectionType === "MCQ") return { ...clean, options: q.options ? q.options.map((o) => (typeof o === "string" ? stripWatermarks(o) : o)) : q.options };
  return { ...clean, options: null, correctOption: null };
}

/** True if this question may be printed in this section. */
export function allowedInSection(q: Pick<QuestionSnapshot, "type" | "options">, sectionType: QType) {
  if (!fitsSection(q.type, sectionType)) return false;
  if (sectionType === "MCQ") return (q.options?.filter((o) => o?.trim()).length ?? 0) >= 2;
  return true;
}

/** Server-side guard used when a paper is saved: drops mismatched questions and strips stray options. */
export function sanitizeSections(sections: PaperSection[]): PaperSection[] {
  return sections.map((s) => ({
    ...s,
    isObjective: s.questionType === "MCQ" ? s.isObjective : false,
    questions: s.questions.filter((q) => allowedInSection(q, s.questionType)).map((q) => normalizeForSection(q, s.questionType)),
  }));
}
