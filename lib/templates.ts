import type { Level, PaperSection, QType } from "./types";
import { SUBJECT_TEMPLATES } from "./subjectTemplates";

/**
 * Starting layouts per academic level. They follow the common Pakistani patterns
 * (BISE-style Part-I objective + Part-II subjective with "attempt any" choices,
 * semester papers for graduation). Every count and mark is editable in the builder
 * because exact distributions differ by board, subject and year.
 */
export type Tpl = Omit<PaperSection, "id" | "questions"> & { count: number };

export const TEMPLATE_GROUPS = [
  "Montessori / Early Years",
  "Primary (1–5)",
  "Middle (6–8)",
  "BISE Punjab — Subject presets (9th/10th)",
  "Matric — Board patterns",
  "Intermediate — Board patterns",
  "Graduation (ADP / BA / BS)",
  "Quick tests",
] as const;
export type TemplateGroup = (typeof TEMPLATE_GROUPS)[number];

export interface PaperTemplate {
  key: string;
  label: string;
  group: TemplateGroup;
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

const OBJ = (count: number, time: string, extra: Partial<Tpl> = {}) =>
  s("Part-I (Objective)", "MCQ", count, 1, { isObjective: true, timeNote: `Time: ${time}`, instructions: "Fill the correct bubble on the OMR sheet. Cutting or overwriting is not allowed.", ...extra });

/**
 * Starting layouts. Board patterns follow the commonly published schemes (Punjab boards new SLO
 * pattern, FBISE Section A/B/C, Inter Part-I/II); counts and marks differ by subject and year,
 * so every number stays editable in the builder.
 */
export const TEMPLATES: PaperTemplate[] = [
  /* ------------------------- Early years ------------------------- */
  {
    key: "ey-english", label: "English activity paper (Playgroup–Prep)", group: "Montessori / Early Years", level: ["EARLY_YEARS"], timeAllowed: "45 Minutes",
    sections: [
      s("Q.1 Match the picture with its letter.", "MATCH_COLUMNS", 1, 5),
      s("Q.2 Fill in the missing letters.", "MISSING_LETTERS", 5, 1),
      s("Q.3 Look at the picture and write its name.", "PICTURE", 4, 1),
      s("Q.4 Trace and write.", "TRACING", 2, 2),
      s("Q.5 Dictation.", "DICTATION", 5, 1),
    ],
  },
  {
    key: "ey-math", label: "Maths activity paper — counting, before/after, tracing", group: "Montessori / Early Years", level: ["EARLY_YEARS"], timeAllowed: "45 Minutes",
    sections: [
      s("Q.1 Count and write the number.", "PICTURE", 4, 1),
      s("Q.2 Write the missing numbers.", "MISSING_LETTERS", 5, 1),
      s("Q.3 What comes before / after?", "FILL_BLANK", 5, 1),
      s("Q.4 Trace the numbers.", "TRACING", 2, 2, { instructions: "Use the square grid." }),
      s("Q.5 Match the number with the picture.", "MATCH_COLUMNS", 1, 4),
    ],
  },
  {
    key: "ey-urdu", label: "اردو — حروف تہجی، جوڑ توڑ، املا (Playgroup–Prep)", group: "Montessori / Early Years", level: ["EARLY_YEARS"], timeAllowed: "45 Minutes",
    sections: [
      s("سوال ۱: خالی جگہ میں درست حرف لکھیں۔", "MISSING_LETTERS", 5, 1),
      s("سوال ۲: تصویر دیکھ کر نام لکھیں۔", "PICTURE", 4, 1),
      s("سوال ۳: حروف جوڑ کر لفظ بنائیں۔", "SHORT", 4, 1),
      s("سوال ۴: املا", "DICTATION", 5, 1),
    ],
  },
  {
    key: "ey-oral", label: "Montessori oral & practical assessment sheet", group: "Montessori / Early Years", level: ["EARLY_YEARS"], timeAllowed: "Oral",
    sections: [
      s("A. Oral — recognises letters / sounds (teacher ticks)", "TRUE_FALSE", 6, 1),
      s("B. Oral — rhymes / poems recited", "SHORT", 3, 2),
      s("C. Colour the picture.", "PICTURE", 2, 2),
      s("D. Trace the pattern.", "TRACING", 2, 2),
    ],
  },
  /* ------------------------- Primary ------------------------- */
  {
    key: "primary-govt", label: "Primary — Govt school pattern (SED/PEC style)", group: "Primary (1–5)", level: ["PRIMARY"], timeAllowed: "2 Hours",
    sections: [
      s("Q.1 Encircle the correct answer.", "MCQ", 10, 1, { isObjective: true }),
      s("Q.2 Fill in the blanks.", "FILL_BLANK", 5, 1),
      s("Q.3 Write True or False.", "TRUE_FALSE", 5, 1),
      s("Q.4 Write short answers. (Attempt any 5)", "SHORT", 7, 2, { attemptAny: 5 }),
      s("Q.5 Answer in detail. (Attempt any 2)", "LONG", 3, 5, { attemptAny: 2 }),
    ],
  },
  {
    key: "primary-private", label: "Primary — premium private school pattern (comprehension + creative)", group: "Primary (1–5)", level: ["PRIMARY"], timeAllowed: "1:30 Hours",
    sections: [
      s("Section A — Reading comprehension", "CASE_STUDY", 1, 10, { instructions: "Read the passage and answer the questions that follow." }),
      s("Section B — Vocabulary: match the words with meanings", "MATCH_COLUMNS", 1, 5),
      s("Section C — Grammar: fill in the blanks", "FILL_BLANK", 5, 1),
      s("Section D — Choose the correct answer", "MCQ", 5, 1),
      s("Section E — Creative writing (write a paragraph / story / letter)", "LONG", 1, 10, { pageBreakBefore: false }),
    ],
  },
  {
    key: "primary-math", label: "Primary Mathematics — MCQ, blanks, sums, word problems", group: "Primary (1–5)", level: ["PRIMARY"], timeAllowed: "2 Hours",
    sections: [
      s("Q.1 Encircle the correct answer.", "MCQ", 8, 1),
      s("Q.2 Fill in the blanks.", "FILL_BLANK", 6, 1),
      s("Q.3 Solve the following.", "NUMERICAL", 6, 2),
      s("Q.4 Word problems. (Attempt any 3)", "NUMERICAL", 4, 4, { attemptAny: 3 }),
    ],
  },
  {
    key: "primary-science", label: "Primary Science / GK / Social Studies", group: "Primary (1–5)", level: ["PRIMARY"], timeAllowed: "1:30 Hours",
    sections: [
      s("Q.1 Tick the correct answer.", "MCQ", 6, 1),
      s("Q.2 Fill in the blanks.", "FILL_BLANK", 5, 1),
      s("Q.3 True or False.", "TRUE_FALSE", 5, 1),
      s("Q.4 Match the columns.", "MATCH_COLUMNS", 1, 5),
      s("Q.5 Answer the questions. (Attempt any 4)", "SHORT", 6, 2, { attemptAny: 4 }),
      s("Q.6 Draw and label the diagram.", "LONG", 1, 4),
    ],
  },
  {
    key: "primary-urdu", label: "اردو — پرائمری (مختصر سوالات، قواعد، مضمون)", group: "Primary (1–5)", level: ["PRIMARY"], timeAllowed: "2 Hours",
    sections: [
      s("سوال ۱: درست جواب پر دائرہ لگائیں۔", "MCQ", 6, 1),
      s("سوال ۲: خالی جگہ پُر کریں۔", "FILL_BLANK", 5, 1),
      s("سوال ۳: مختصر جواب دیں۔ (کوئی سے چار)", "SHORT", 6, 2, { attemptAny: 4 }),
      s("سوال ۴: الفاظ کے معنی / جملے بنائیں۔", "SHORT", 5, 1),
      s("سوال ۵: مضمون / کہانی / درخواست لکھیں۔", "LONG", 1, 10),
    ],
  },
  /* ------------------------- Middle ------------------------- */
  {
    key: "middle-annual", label: "Middle (6–8) — annual / term paper", group: "Middle (6–8)", level: ["MIDDLE"], timeAllowed: "2:30 Hours",
    sections: [
      OBJ(15, "20 Minutes"),
      s("Q.2 Write short answers to any SIX questions.", "SHORT", 9, 2, { attemptAny: 6, pageBreakBefore: true }),
      s("Q.3 Write short answers to any SIX questions.", "SHORT", 9, 2, { attemptAny: 6 }),
      s("Part-II — Attempt any THREE questions.", "LONG", 5, 7, { attemptAny: 3 }),
    ],
  },
  {
    key: "middle-pec", label: "Middle (8th) — school-based assessment (SBA) style", group: "Middle (6–8)", level: ["MIDDLE"], timeAllowed: "2 Hours",
    sections: [
      OBJ(20, "25 Minutes"),
      s("Section B — Constructed response (short)", "SHORT", 8, 3, { attemptAny: 6, pageBreakBefore: true }),
      s("Section C — Extended response", "LONG", 3, 6, { attemptAny: 2 }),
    ],
  },
  /* ------------------------- Matric ------------------------- */
  {
    key: "punjab-matric-slo", label: "Punjab Boards 9th/10th Science — new SLO pattern (60 marks)", group: "Matric — Board patterns", level: ["MATRIC"], timeAllowed: "2 Hours",
    sections: [
      OBJ(12, "15 Minutes"),
      s("Q.2 Write short answers to any FIVE questions.", "SHORT", 8, 2, { attemptAny: 5, pageBreakBefore: true }),
      s("Q.3 Write short answers to any FIVE questions.", "SHORT", 8, 2, { attemptAny: 5 }),
      s("Q.4 Write short answers to any FIVE questions.", "SHORT", 8, 2, { attemptAny: 5 }),
      s("Section-II — Attempt any TWO questions.", "LONG", 3, 9, { attemptAny: 2 }),
    ],
  },
  {
    key: "punjab-matric-75", label: "Punjab Boards Matric — classic 75-marks pattern", group: "Matric — Board patterns", level: ["MATRIC"], timeAllowed: "2:10 Hours",
    sections: [
      OBJ(15, "20 Minutes"),
      s("Q.2 Write short answers to any SIX questions.", "SHORT", 9, 2, { attemptAny: 6, pageBreakBefore: true }),
      s("Q.3 Write short answers to any SIX questions.", "SHORT", 9, 2, { attemptAny: 6 }),
      s("Q.4 Write short answers to any SIX questions.", "SHORT", 9, 2, { attemptAny: 6 }),
      s("Section-II — Attempt any THREE questions.", "LONG", 5, 8, { attemptAny: 3 }),
    ],
  },
  {
    key: "fbise-ssc", label: "Federal Board (FBISE) SSC — Section A / B / C", group: "Matric — Board patterns", level: ["MATRIC"], timeAllowed: "2:40 Hours",
    sections: [
      s("SECTION – A (Marks 12)", "MCQ", 12, 1, { isObjective: true, timeNote: "Time: 20 Minutes", instructions: "Encircle / fill the correct option. Deleting or overwriting is not allowed." }),
      s("SECTION – B: Attempt any ELEVEN parts.", "SHORT", 15, 3, { attemptAny: 11, pageBreakBefore: true }),
      s("SECTION – C: Attempt any TWO questions.", "LONG", 3, 10, { attemptAny: 2 }),
    ],
  },
  {
    key: "fbise-50", label: "FBISE new 50% objective pattern (SSC-I / HSSC-I from 2026)", group: "Matric — Board patterns", level: ["MATRIC", "INTERMEDIATE"], timeAllowed: "2:30 Hours",
    sections: [
      s("SECTION – A (Objective, 50%)", "MCQ", 30, 1, { isObjective: true, timeNote: "Time: 40 Minutes", instructions: "Fill the correct bubble on the OMR sheet." }),
      s("SECTION – B: Attempt any FIVE parts.", "SHORT", 7, 3, { attemptAny: 5, pageBreakBefore: true }),
      s("SECTION – C: Attempt any THREE questions.", "LONG", 4, 5, { attemptAny: 3 }),
    ],
  },
  {
    key: "matric-arts", label: "Matric Arts subjects — Urdu / Islamiat / Pak Studies (75 marks)", group: "Matric — Board patterns", level: ["MATRIC"], timeAllowed: "2:10 Hours",
    sections: [
      OBJ(15, "20 Minutes"),
      s("Q.2 Write short answers to any EIGHT questions.", "SHORT", 12, 2, { attemptAny: 8, pageBreakBefore: true }),
      s("Q.3 Write short answers to any SIX questions.", "SHORT", 9, 2, { attemptAny: 6 }),
      s("Section-II — Attempt any FOUR questions.", "LONG", 6, 8, { attemptAny: 4 }),
    ],
  },
  /* ------------------------- Intermediate ------------------------- */
  {
    key: "punjab-inter", label: "Punjab Boards Inter Science (Part-I / Part-II, 85 marks)", group: "Intermediate — Board patterns", level: ["INTERMEDIATE"], timeAllowed: "2:40 Hours",
    sections: [
      OBJ(17, "20 Minutes"),
      s("Q.2 Write short answers to any EIGHT questions.", "SHORT", 12, 2, { attemptAny: 8, pageBreakBefore: true }),
      s("Q.3 Write short answers to any EIGHT questions.", "SHORT", 12, 2, { attemptAny: 8 }),
      s("Q.4 Write short answers to any SIX questions.", "SHORT", 9, 2, { attemptAny: 6 }),
      s("Section-II — Attempt any THREE questions.", "LONG", 5, 8, { attemptAny: 3 }),
    ],
  },
  {
    key: "punjab-inter-arts", label: "Punjab Boards Inter Arts / Commerce (100 marks)", group: "Intermediate — Board patterns", level: ["INTERMEDIATE"], timeAllowed: "3 Hours",
    sections: [
      OBJ(20, "30 Minutes"),
      s("Q.2 Write short answers to any TEN questions.", "SHORT", 15, 2, { attemptAny: 10, pageBreakBefore: true }),
      s("Q.3 Write short answers to any EIGHT questions.", "SHORT", 12, 2, { attemptAny: 8 }),
      s("Section-II — Attempt any FOUR questions.", "LONG", 6, 11, { attemptAny: 4 }),
    ],
  },
  {
    key: "fbise-hssc", label: "Federal Board (FBISE) HSSC — Section A / B / C (75 marks)", group: "Intermediate — Board patterns", level: ["INTERMEDIATE"], timeAllowed: "3 Hours",
    sections: [
      s("SECTION – A (Marks 13)", "MCQ", 13, 1, { isObjective: true, timeNote: "Time: 25 Minutes" }),
      s("SECTION – B: Attempt any FOURTEEN parts.", "SHORT", 28, 3, { attemptAny: 14, pageBreakBefore: true }),
      s("SECTION – C: Attempt any FOUR questions.", "LONG", 8, 5, { attemptAny: 4 }),
    ],
  },
  /* ------------------------- Graduation ------------------------- */
  {
    key: "semester-final", label: "BS / ADP — Semester final (50 marks)", group: "Graduation (ADP / BA / BS)", level: ["GRADUATION"], timeAllowed: "3 Hours",
    sections: [
      s("Section A — Objective", "MCQ", 10, 1, { isObjective: true }),
      s("Section B — Short questions (attempt any 5 of 7)", "SHORT", 7, 4, { attemptAny: 5 }),
      s("Section C — Long questions (attempt any 2 of 3)", "LONG", 3, 10, { attemptAny: 2 }),
    ],
  },
  {
    key: "semester-mid", label: "BS / ADP — Mid-term (30 marks)", group: "Graduation (ADP / BA / BS)", level: ["GRADUATION"], timeAllowed: "1:30 Hours",
    sections: [
      s("Section A — Objective", "MCQ", 10, 1, { isObjective: true }),
      s("Section B — Short questions (attempt any 4 of 5)", "SHORT", 5, 3, { attemptAny: 4 }),
      s("Section C — Case study / problem", "CASE_STUDY", 1, 8),
    ],
  },
  {
    key: "semester-cs", label: "BS Computing — theory + code", group: "Graduation (ADP / BA / BS)", level: ["GRADUATION"], timeAllowed: "3 Hours",
    sections: [
      s("Section A — MCQs", "MCQ", 10, 1, { isObjective: true }),
      s("Section B — Short questions (attempt any 4)", "SHORT", 6, 4, { attemptAny: 4 }),
      s("Section C — Write / trace the code", "CODE", 3, 8, { attemptAny: 2 }),
      s("Section D — Case study", "CASE_STUDY", 1, 8),
    ],
  },
  {
    key: "annual-ba", label: "BA / BSc / ADP — Annual (100 marks)", group: "Graduation (ADP / BA / BS)", level: ["GRADUATION"], timeAllowed: "3 Hours",
    sections: [
      s("Q.1 Short questions — attempt any 10 of 15.", "SHORT", 15, 2, { attemptAny: 10 }),
      s("Attempt any FOUR questions.", "LONG", 7, 20, { attemptAny: 4 }),
    ],
  },
  /* ------------------------- Quick ------------------------- */
  {
    key: "weekly-quiz", label: "Weekly quiz (any class, A5 2-up friendly)", group: "Quick tests", level: ["EARLY_YEARS", "PRIMARY", "MIDDLE", "MATRIC", "INTERMEDIATE", "GRADUATION"], timeAllowed: "30 Minutes",
    sections: [s("Q.1 Choose the correct answer.", "MCQ", 5, 1), s("Q.2 Fill in the blanks.", "FILL_BLANK", 5, 1), s("Q.3 Short answers.", "SHORT", 3, 2)],
  },
  {
    key: "chapter-test", label: "Chapter test (25 marks)", group: "Quick tests", level: ["PRIMARY", "MIDDLE", "MATRIC", "INTERMEDIATE", "GRADUATION"], timeAllowed: "45 Minutes",
    sections: [s("Q.1 MCQs", "MCQ", 5, 1, { isObjective: true }), s("Q.2 Short questions (any 5)", "SHORT", 7, 2, { attemptAny: 5 }), s("Q.3 Long question (any 1)", "LONG", 2, 10, { attemptAny: 1 })],
  },
];

// BISE Punjab subject-wise presets also appear in the template list.
TEMPLATES.unshift(
  ...SUBJECT_TEMPLATES.map((t): PaperTemplate => ({ key: t.key, label: t.label, group: "BISE Punjab — Subject presets (9th/10th)", level: t.levels, timeAllowed: t.timeAllowed, sections: t.sections })),
);

/** Marks counted toward the total respect "attempt any" rules. */
export function sectionMarks(sec: Pick<PaperSection, "attemptAny" | "marksEach" | "questions" | "questionType">) {
  if (sec.questionType === "MATCH_COLUMNS") return sec.questions.reduce((a, q) => a + (q.marks || sec.marksEach), 0);
  const n = sec.attemptAny && sec.attemptAny > 0 ? Math.min(sec.attemptAny, sec.questions.length) : sec.questions.length;
  return n * sec.marksEach;
}

export function paperTotal(sections: PaperSection[]) {
  return sections.reduce((a, sec) => a + sectionMarks(sec), 0);
}
