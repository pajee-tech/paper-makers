// Shared client/server types (kept free of Prisma imports so client components can use them)

export type QType =
  | "MCQ" | "TRUE_FALSE" | "FILL_BLANK" | "MATCH_COLUMNS" | "MISSING_LETTERS" | "DICTATION"
  | "TRACING" | "PICTURE" | "SHORT" | "LONG" | "NUMERICAL" | "TRANSLATION" | "CASE_STUDY" | "CODE";

export type Level = "EARLY_YEARS" | "PRIMARY" | "MIDDLE" | "MATRIC" | "INTERMEDIATE" | "GRADUATION";

export type PaperTypeT = "WEEKLY" | "MONTHLY" | "MID_TERM" | "SEND_UP" | "ANNUAL" | "SEMESTER";

export interface MatchPair { left: string; right: string }

/** A question as frozen inside a SavedPaper. */
export interface QuestionSnapshot {
  id: string; // bank id, or "custom-xxxx"
  type: QType;
  text: string;
  urduText?: string | null;
  options?: string[] | null;
  correctOption?: number | null;
  answer?: string | null;
  matchPairs?: MatchPair[] | null;
  imageSnippet?: string | null;
  icon?: string | null;
  needsLines?: boolean;
  lineStyle?: "FOUR_LINE" | "SQUARE" | "PLAIN" | null;
  lineCount?: number;
  marks: number;
}

export interface PaperSection {
  id: string;
  title: string; // "Part-I (Objective)", "Section B", "Q.2 Write short answers"
  instructions?: string; // "Attempt any 5 out of 8"
  urduInstructions?: string;
  questionType: QType;
  attemptAny?: number | null; // choice rule: attempt N of the questions listed
  marksEach: number;
  isObjective?: boolean; // Part-I → OMR sheet + answer key
  timeNote?: string; // "Time: 20 minutes"
  pageBreakBefore?: boolean;
  rtl?: boolean; // section printed right-to-left (Urdu, Islamiat, Tarjuma-tul-Quran)
  partsNote?: string; // long questions with parts, e.g. "(a) 5 + (b) 4"
  questions: QuestionSnapshot[];
}

export type PaperSize = "A4" | "LEGAL" | "LETTER" | "A5_2UP" | "FOLIO";

export interface PrintSettings {
  size: PaperSize;
  orientation: "portrait" | "landscape";
  columns: 1 | 2;
  fontSize: number; // pt
  showKey: boolean;
  showOmr: boolean;
  marginMm: number;
}

export interface PaperDTO {
  id: string;
  title: string;
  paperType: PaperTypeT;
  examDate?: string | null;
  timeAllowed?: string | null;
  totalMarks: number;
  sections: PaperSection[];
  printSettings?: PrintSettings | null;
  watermark: boolean;
  watermarkText?: string;
  className?: string | null;
  subjectName?: string | null;
  subjectIsUrdu?: boolean;
  institution: { name: string; city?: string | null; address?: string | null; logoDataUrl?: string | null };
}

export interface ScoreRow {
  rollNo: string;
  studentName: string;
  fatherName?: string;
  parentPhone?: string;
  mcqObtained?: number | null;
  subjectiveObtained?: number | null;
  obtained: number;
  absent?: boolean;
  breakdown?: unknown;
  source?: "MANUAL" | "EXCEL" | "PDF_OMR";
  // computed
  percentage?: number;
  grade?: string;
  passed?: boolean;
  position?: number | null;
}

export interface GradeBand { grade: string; min: number }

export const QTYPE_LABEL: Record<QType, string> = {
  MCQ: "Multiple Choice (MCQs)",
  TRUE_FALSE: "True / False",
  FILL_BLANK: "Fill in the Blanks",
  MATCH_COLUMNS: "Match the Columns",
  MISSING_LETTERS: "Missing Letters / Numbers",
  DICTATION: "Dictation",
  TRACING: "Tracing / Writing Practice",
  PICTURE: "Picture Question",
  SHORT: "Short Questions",
  LONG: "Long Questions",
  NUMERICAL: "Numerical Problems",
  TRANSLATION: "Translation",
  CASE_STUDY: "Case Study",
  CODE: "Programming / Code",
};

export const LEVEL_LABEL: Record<Level, string> = {
  EARLY_YEARS: "Nursery / KG / Prep",
  PRIMARY: "Primary (1st–5th)",
  MIDDLE: "Middle (6th–8th)",
  MATRIC: "Matric (9th–10th)",
  INTERMEDIATE: "Intermediate (11th–12th)",
  GRADUATION: "Graduation (BA/BSc/ADP/BS)",
};

export const PAPER_TYPE_LABEL: Record<PaperTypeT, string> = {
  WEEKLY: "Weekly Test",
  MONTHLY: "Monthly Test",
  MID_TERM: "Mid-Term Examination",
  SEND_UP: "Send-Up Examination",
  ANNUAL: "Annual Examination",
  SEMESTER: "Semester Examination",
};

export const QTYPE_SHORT: Record<QType, string> = {
  MCQ: "MCQ", TRUE_FALSE: "T/F", FILL_BLANK: "Blank", MATCH_COLUMNS: "Match", MISSING_LETTERS: "Missing", DICTATION: "Dictation",
  TRACING: "Tracing", PICTURE: "Picture", SHORT: "Short", LONG: "Long", NUMERICAL: "Numerical", TRANSLATION: "Translation", CASE_STUDY: "Case", CODE: "Code",
};
