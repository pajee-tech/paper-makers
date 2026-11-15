import type { Level, PaperSection, QType } from "./types";

/**
 * Starting layouts per academic level. They follow the common Pakistani patterns
 * (BISE-style Part-I objective + Part-II subjective with "attempt any" choices,
 * semester papers for graduation). Every count and mark is editable in the builder
 * because exact distributions differ by board, subject and year.
 */
type Tpl = Omit<PaperSection, "id" | "questions"> & { count: number };

export interface PaperTemplate {
  key: string;
  label: string;
  level: Level[];
  timeAllowed: string;
  sections: Tpl[];
}

const s = (title: string, questionType: QType, count: number, marksEach: number, extra: Partial<Tpl> = {}): Tpl => ({
  title,
  questionType,
  count,
  marksEach,
  ...extra,
});

export const TEMPLATES: PaperTemplate[] = [
  {
    key: "early-years",
    label: "Nursery / KG / Prep — activity paper",
    level: ["EARLY_YEARS"],
    timeAllowed: "1 Hour",
    sections: [
      s("Q.1 Match the columns.", "MATCH_COLUMNS", 1, 5),
      s("Q.2 Fill in the missing letters / numbers.", "MISSING_LETTERS", 5, 1),
      s("Q.3 Look at the picture and write its name.", "PICTURE", 4, 1),
      s("Q.4 Trace and write.", "TRACING", 2, 2),
      s("Q.5 Dictation.", "DICTATION", 5, 1),
    ],
  },
  {
    key: "primary",
    label: "Primary (1st–5th) — mixed objective + short",
    level: ["PRIMARY"],
    timeAllowed: "1:30 Hours",
    sections: [
      s("Q.1 Encircle the correct answer.", "MCQ", 5, 1),
      s("Q.2 Fill in the blanks.", "FILL_BLANK", 5, 1),
      s("Q.3 Write True or False.", "TRUE_FALSE", 5, 1),
      s("Q.4 Match the columns.", "MATCH_COLUMNS", 1, 5),
      s("Q.5 Answer the following questions.", "SHORT", 5, 2, { instructions: "Attempt any 4.", attemptAny: 4 }),
    ],
  },
  {
    key: "bise-matric",
    label: "Matric (9th–10th) — BISE pattern",
    level: ["MIDDLE", "MATRIC"],
    timeAllowed: "2:10 Hours",
    sections: [
      s("Part-I (Objective)", "MCQ", 12, 1, { isObjective: true, timeNote: "Time: 15 Minutes", instructions: "Fill the correct bubble on the OMR sheet. Cutting or overwriting will not be accepted." }),
      s("Q.2 Write short answers to any FIVE questions.", "SHORT", 8, 2, { attemptAny: 5, pageBreakBefore: true }),
      s("Q.3 Write short answers to any FIVE questions.", "SHORT", 8, 2, { attemptAny: 5 }),
      s("Q.4 Write short answers to any FIVE questions.", "SHORT", 8, 2, { attemptAny: 5 }),
      s("Part-II Section B — Attempt any THREE questions.", "LONG", 5, 8, { attemptAny: 3 }),
    ],
  },
  {
    key: "bise-inter",
    label: "Intermediate (11th–12th) — BISE pattern",
    level: ["INTERMEDIATE"],
    timeAllowed: "2:40 Hours",
    sections: [
      s("Part-I (Objective)", "MCQ", 17, 1, { isObjective: true, timeNote: "Time: 20 Minutes", instructions: "Fill the correct bubble on the OMR sheet." }),
      s("Q.2 Write short answers to any EIGHT questions.", "SHORT", 12, 2, { attemptAny: 8, pageBreakBefore: true }),
      s("Q.3 Write short answers to any EIGHT questions.", "SHORT", 12, 2, { attemptAny: 8 }),
      s("Q.4 Write short answers to any SIX questions.", "SHORT", 9, 2, { attemptAny: 6 }),
      s("Section-II — Attempt any THREE questions.", "LONG", 5, 8, { attemptAny: 3 }),
    ],
  },
  {
    key: "semester",
    label: "Graduation — Semester (Mid/Final)",
    level: ["GRADUATION"],
    timeAllowed: "3 Hours",
    sections: [
      s("Section A — Objective", "MCQ", 10, 1, { isObjective: true }),
      s("Section B — Short Questions (attempt any 5 of 7)", "SHORT", 7, 4, { attemptAny: 5 }),
      s("Section C — Long Questions (attempt any 2 of 3)", "LONG", 3, 10, { attemptAny: 2 }),
      s("Section D — Case Study", "CASE_STUDY", 1, 10),
    ],
  },
  {
    key: "annual-ba",
    label: "Graduation — Annual (BA/BSc/ADP)",
    level: ["GRADUATION"],
    timeAllowed: "3 Hours",
    sections: [
      s("Q.1 Short questions — attempt any 10 of 15.", "SHORT", 15, 2, { attemptAny: 10 }),
      s("Attempt any FOUR questions.", "LONG", 7, 20, { attemptAny: 4 }),
    ],
  },
  {
    key: "weekly-quiz",
    label: "Weekly quiz (any class, A5 2-up friendly)",
    level: ["EARLY_YEARS", "PRIMARY", "MIDDLE", "MATRIC", "INTERMEDIATE", "GRADUATION"],
    timeAllowed: "30 Minutes",
    sections: [s("Q.1 Choose the correct answer.", "MCQ", 5, 1), s("Q.2 Fill in the blanks.", "FILL_BLANK", 5, 1), s("Q.3 Short answers.", "SHORT", 3, 2)],
  },
];

/** Marks counted toward the total respect "attempt any" rules. */
export function sectionMarks(sec: Pick<PaperSection, "attemptAny" | "marksEach" | "questions" | "questionType">) {
  if (sec.questionType === "MATCH_COLUMNS") return sec.questions.reduce((a, q) => a + (q.marks || sec.marksEach), 0);
  const n = sec.attemptAny && sec.attemptAny > 0 ? Math.min(sec.attemptAny, sec.questions.length) : sec.questions.length;
  return n * sec.marksEach;
}

export function paperTotal(sections: PaperSection[]) {
  return sections.reduce((a, sec) => a + sectionMarks(sec), 0);
}
