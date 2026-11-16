// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * Saved papers store question IDs (+ a small text-only backup).
 *  - Question-bank and textbook questions are saved as references: { id, ref: "q" | "b", type, marks, c }.
 *    `c` is a light copy of the wording (no image data), used only if the original can't be found,
 *    so a printed paper never loses its questions.
 *  - Only questions a teacher typed inside the builder ("custom-…") keep their content, because they exist nowhere else.
 *  - When a paper is opened, reprinted or used for results, references are resolved in 2 indexed queries.
 * No PDF or HTML is ever stored: printing happens in the browser.
 */
import { prisma } from "./prisma";
import { normalizeForSection } from "./questionRules";
import type { PaperSection, QType, QuestionSnapshot } from "./types";

export type RefKind = "q" | "b";
type LightCopy = Pick<QuestionSnapshot, "text" | "urduText" | "options" | "correctOption" | "answer" | "matchPairs" | "icon" | "needsLines" | "lineStyle" | "lineCount"> & { hasImage?: boolean };
export interface QuestionRef { id: string; ref: RefKind; type: QType; marks: number; c?: LightCopy }
type StoredQuestion = QuestionSnapshot | QuestionRef;
export type StoredSection = Omit<PaperSection, "questions"> & { questions: StoredQuestion[] };

const BOOK_PREFIX = "book-";
const isRef = (q: StoredQuestion): q is QuestionRef => "ref" in q && (q.ref === "q" || q.ref === "b");

const lightCopy = (q: QuestionSnapshot): LightCopy => ({
  text: q.text, urduText: q.urduText ?? null, options: q.options ?? null, correctOption: q.correctOption ?? null, answer: q.answer ?? null,
  matchPairs: q.matchPairs ?? null, icon: q.icon ?? null, needsLines: !!q.needsLines, lineStyle: q.lineStyle ?? null, lineCount: q.lineCount ?? 2,
  hasImage: !!q.imageSnippet,
});

/** Builder ids → storage: bank cuid → {ref:"q"}, "book-<id>" → {ref:"b"}, "custom-…" → full content. */
export function compactSections(sections: PaperSection[]): StoredSection[] {
  return sections.map((s) => ({
    ...s,
    questions: s.questions.map((q): StoredQuestion => {
      if (q.id.startsWith("custom-")) return q;
      if (q.id.startsWith(BOOK_PREFIX)) return { id: q.id.slice(BOOK_PREFIX.length), ref: "b", type: q.type, marks: q.marks, c: lightCopy(q) };
      return { id: q.id, ref: "q", type: q.type, marks: q.marks, c: lightCopy(q) };
    }),
  }));
}

/** Original not found → use the stored text copy; only very old references without a copy show a notice. */
const fallback = (r: QuestionRef): QuestionSnapshot => ({
  id: r.ref === "b" ? `${BOOK_PREFIX}${r.id}` : r.id,
  type: r.type,
  marks: r.marks,
  ...(r.c?.text || r.c?.urduText
    ? { ...r.c, text: r.c.text ?? "" }
    : { text: "[This question is no longer available — edit the paper to replace it]", options: r.type === "MCQ" ? ["—", "—", "—", "—"] : null }),
});

const BSELECT = { id: true, type: true, text: true, urduText: true, options: true, correctOption: true, answer: true, matchPairs: true, imageSnippet: true } as const;
const QSELECT = { ...BSELECT, icon: true, needsLines: true, lineStyle: true, lineCount: true } as const;
type Row = { id: string; type: string; text: string; urduText: string | null; options: unknown; correctOption: number | null; answer: string | null; matchPairs: unknown; imageSnippet: string | null; icon?: string | null; needsLines?: boolean; lineStyle?: string | null; lineCount?: number };

/** Resolves references back to full questions (old papers that stored full copies pass through unchanged). */
export interface Viewer { institutionId: string; role?: string }

/**
 * `viewer` must get the same book access as the builder: the Super Admin can use any book;
 * everyone else uses shared books + their own institution's books.
 */
export async function expandSections(stored: unknown, viewer: Viewer | string): Promise<PaperSection[]> {
  const { institutionId, role } = typeof viewer === "string" ? { institutionId: viewer, role: undefined } : viewer;
  const sections = (stored ?? []) as StoredSection[];
  const qIds = new Set<string>();
  const bIds = new Set<string>();
  for (const s of sections) for (const q of s.questions) if (isRef(q)) (q.ref === "q" ? qIds : bIds).add(q.id);

  const [qs, bs] = await Promise.all([
    qIds.size
      ? prisma.question.findMany({ where: { id: { in: [...qIds] }, chapter: { subject: { class: { institutionId } } } }, select: QSELECT })
      : Promise.resolve([]),
    bIds.size
      ? prisma.bookItem.findMany({
          where: { id: { in: [...bIds] }, ...(role === "SUPER_ADMIN" ? {} : { book: { OR: [{ institutionId: null }, { institutionId }] } }) },
          select: BSELECT,
        })
      : Promise.resolve([]),
  ]);
  const qMap = new Map<string, Row>(qs.map((q) => [q.id, q]));
  const bMap = new Map<string, Row>(bs.map((q) => [q.id, q]));

  return sections.map((s) => ({
    ...s,
    questions: s.questions.map((q) => {
      if (!isRef(q)) return q;
      const row = q.ref === "q" ? qMap.get(q.id) : bMap.get(q.id);
      if (!row) return normalizeForSection(fallback(q), s.questionType);
      const snap: QuestionSnapshot = {
        id: q.ref === "b" ? `${BOOK_PREFIX}${row.id}` : row.id,
        type: row.type as QType,
        text: row.text,
        urduText: row.urduText,
        options: (row.options as string[] | null) ?? null,
        correctOption: row.correctOption,
        answer: row.answer,
        matchPairs: (row.matchPairs as QuestionSnapshot["matchPairs"]) ?? null,
        imageSnippet: row.imageSnippet,
        icon: row.icon ?? null,
        needsLines: !!row.needsLines,
        lineStyle: (row.lineStyle as QuestionSnapshot["lineStyle"]) ?? null,
        lineCount: row.lineCount ?? 2,
        marks: q.marks,
      };
      return normalizeForSection(snap, s.questionType);
    }),
  }));
}
