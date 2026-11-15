import { z } from "zod";

export const QTypeZ = z.enum([
  "MCQ", "TRUE_FALSE", "FILL_BLANK", "MATCH_COLUMNS", "MISSING_LETTERS", "DICTATION", "TRACING",
  "PICTURE", "SHORT", "LONG", "NUMERICAL", "TRANSLATION", "CASE_STUDY", "CODE",
]);

// ~350 KB per image snippet is plenty for a compressed WebP crop.
const dataUrl = z.string().max(500_000).refine((s) => s.startsWith("data:image/"), "must be an image data URL");

export const QuestionInput = z.object({
  type: QTypeZ,
  text: z.string().max(20_000).default(""),
  urduText: z.string().max(20_000).nullish(),
  options: z.array(z.string().max(2000)).max(6).nullish(),
  correctOption: z.number().int().min(0).max(5).nullish(),
  answer: z.string().max(5000).nullish(),
  matchPairs: z.array(z.object({ left: z.string().max(500), right: z.string().max(500) })).max(15).nullish(),
  imageSnippet: dataUrl.nullish(),
  icon: z.string().max(40).nullish(),
  needsLines: z.boolean().optional(),
  lineStyle: z.enum(["FOUR_LINE", "SQUARE", "PLAIN"]).nullish(),
  lineCount: z.number().int().min(0).max(30).optional(),
  marks: z.number().min(0).max(100).optional(),
  difficulty: z.number().int().min(1).max(3).optional(),
});

export const QuestionSnapshotZ = QuestionInput.extend({ id: z.string(), marks: z.number().min(0).max(100) });

export const SectionZ = z.object({
  id: z.string(),
  title: z.string().max(300),
  instructions: z.string().max(1000).optional(),
  urduInstructions: z.string().max(1000).optional(),
  questionType: QTypeZ,
  attemptAny: z.number().int().min(0).max(100).nullish(),
  marksEach: z.number().min(0).max(100),
  isObjective: z.boolean().optional(),
  timeNote: z.string().max(100).optional(),
  pageBreakBefore: z.boolean().optional(),
  rtl: z.boolean().optional(),
  partsNote: z.string().max(60).optional(),
  questions: z.array(QuestionSnapshotZ).max(200),
});

export const PrintSettingsZ = z.object({
  size: z.enum(["A4", "LEGAL", "LETTER", "A5_2UP", "FOLIO"]),
  orientation: z.enum(["portrait", "landscape"]),
  columns: z.union([z.literal(1), z.literal(2)]),
  fontSize: z.number().min(7).max(18),
  showKey: z.boolean(),
  showOmr: z.boolean(),
  marginMm: z.number().min(0).max(30),
});

export const PaperInput = z.object({
  title: z.string().min(1).max(200),
  paperType: z.enum(["WEEKLY", "MONTHLY", "MID_TERM", "SEND_UP", "ANNUAL", "SEMESTER"]),
  examDate: z.string().nullish(),
  timeAllowed: z.string().max(50).nullish(),
  classId: z.string().nullish(),
  subjectId: z.string().nullish(),
  sections: z.array(SectionZ).min(1).max(30),
  printSettings: PrintSettingsZ.nullish(),
});

export const ScoreInput = z.object({
  rollNo: z.string().max(30),
  studentName: z.string().max(100),
  fatherName: z.string().max(100).optional(),
  parentPhone: z.string().max(30).optional(),
  mcqObtained: z.number().min(0).nullish(),
  subjectiveObtained: z.number().min(0).nullish(),
  obtained: z.number().min(0),
  absent: z.boolean().optional(),
  breakdown: z.any().optional(),
  source: z.enum(["MANUAL", "EXCEL", "PDF_OMR"]).optional(),
});
