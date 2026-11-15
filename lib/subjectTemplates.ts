// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * BISE Punjab Boards (Lahore, Gujranwala, Faisalabad, Multan, Rawalpindi, Sargodha, Bahawalpur,
 * Sahiwal, DG Khan) — subject-wise paper presets for 9th / 10th.
 * Choosing a subject in the paper builder loads its marks, time allowed and section rules.
 * Every count and mark remains editable because boards revise schemes from time to time.
 */
import type { Tpl } from "./templates";
import type { Level, QType } from "./types";

export interface SubjectTemplate {
  key: string;
  label: string;
  match: RegExp; // tested against the subject name
  levels: Level[];
  totalMarks: number;
  timeAllowed: string;
  rtl?: boolean;
  sections: Tpl[];
}

const sec = (title: string, questionType: QType, count: number, marksEach: number, extra: Partial<Tpl> = {}): Tpl => ({ title, questionType, count, marksEach, ...extra });

const objective = (count: number, time: string, rtl = false): Tpl =>
  sec(rtl ? "حصہ معروضی (Objective)" : "Part-I (Objective)", "MCQ", count, 1, {
    isObjective: true,
    rtl,
    timeNote: rtl ? `وقت: ${time}` : `Time: ${time}`,
    instructions: rtl ? "ہر سوال کے چار ممکنہ جوابات دیے گئے ہیں۔ درست جواب کے مطابق OMR شیٹ پر دائرہ پُر کریں۔" : "Each question has four options. Fill the correct bubble on the OMR sheet. Cutting or overwriting is not allowed.",
  });

const shortTrio = (count: number, attempt: number, words: string): Tpl[] =>
  [2, 3, 4].map((n, i) =>
    sec(`Q.${n} Write short answers to any ${words} questions.`, "SHORT", count, 2, { attemptAny: attempt, pageBreakBefore: i === 0 }),
  );

export const SUBJECT_TEMPLATES: SubjectTemplate[] = [
  {
    key: "bise-science",
    label: "BISE Punjab — Physics / Chemistry / Biology (60 marks · 2:00 hrs)",
    match: /^(physics|chemistry|biology)\b/i,
    levels: ["MATRIC"],
    totalMarks: 60,
    timeAllowed: "2:00 Hours",
    sections: [
      objective(12, "15 Minutes"),
      ...shortTrio(8, 5, "FIVE"),
      sec("Section-II: Attempt any TWO questions.", "LONG", 3, 9, { attemptAny: 2, partsNote: "(a) 5 + (b) 4", instructions: "Each question has two parts, (a) and (b)." }),
    ],
  },
  {
    key: "bise-cs",
    label: "BISE Punjab — Computer Science (50 marks · 2:00 hrs)",
    match: /computer/i,
    levels: ["MATRIC"],
    totalMarks: 50,
    timeAllowed: "2:00 Hours",
    sections: [
      objective(10, "15 Minutes"),
      ...shortTrio(6, 4, "FOUR"),
      sec("Section-II: Attempt any TWO questions.", "LONG", 3, 8, { attemptAny: 2 }),
    ],
  },
  {
    key: "bise-math",
    label: "BISE Punjab — Mathematics (75 marks · 2:30 hrs)",
    match: /^(general\s+)?math(ematic)?s?\b/i,
    levels: ["MATRIC"],
    totalMarks: 75,
    timeAllowed: "2:30 Hours",
    sections: [
      objective(15, "20 Minutes"),
      ...shortTrio(9, 6, "SIX"),
      sec("Section-II: Attempt any THREE questions. The last question (Theorem) is compulsory.", "LONG", 5, 8, {
        attemptAny: 3,
        partsNote: "(a) 4 + (b) 4",
        instructions: "Each question has two parts, (a) and (b). Question on Theorem is compulsory.",
      }),
    ],
  },
  {
    key: "bise-english",
    label: "BISE Punjab — English (75 marks · 2:30 hrs)",
    match: /^english\b/i,
    levels: ["MATRIC"],
    totalMarks: 75,
    timeAllowed: "2:30 Hours",
    sections: [
      objective(19, "20 Minutes"),
      sec("Q.2 Write short answers to any FIVE questions.", "SHORT", 8, 2, { attemptAny: 5, pageBreakBefore: true }),
      sec("Q.3 Translate the following paragraph into Urdu / Paraphrase the stanza.", "TRANSLATION", 1, 8),
      sec("Q.4 Write the summary of the poem OR explain the stanza with reference to the context.", "LONG", 2, 5, { attemptAny: 1 }),
      sec("Q.5 Write a letter OR a story.", "LONG", 2, 8, { attemptAny: 1 }),
      sec("Q.6 Write an essay on any ONE of the following topics.", "LONG", 3, 10, { attemptAny: 1 }),
      sec("Q.7 Read the passage carefully and answer the questions given at the end.", "CASE_STUDY", 1, 10),
      sec("Q.8 Change the voice (Active/Passive) OR change the narration (Direct/Indirect).", "SHORT", 5, 1),
    ],
  },
  {
    key: "bise-urdu",
    label: "BISE Punjab — Urdu (75 marks · 2:30 hrs) · RTL",
    match: /^(urdu|اردو)/i,
    levels: ["MATRIC"],
    totalMarks: 75,
    timeAllowed: "2:30 Hours",
    rtl: true,
    sections: [
      objective(15, "15 منٹ", true),
      sec("سوال نمبر ۲: درج ذیل اشعار کی تشریح کیجیے، نظم کا عنوان اور شاعر کا نام بھی لکھیے۔ (کوئی سے دو)", "LONG", 3, 5, { attemptAny: 2, rtl: true, pageBreakBefore: true }),
      sec("سوال نمبر ۳: درج ذیل نثر پارے کی سیاق و سباق کے حوالے سے تشریح کیجیے۔", "LONG", 2, 10, { attemptAny: 1, rtl: true }),
      sec("سوال نمبر ۴: درج ذیل سوالات کے مختصر جوابات لکھیے۔ (کوئی سے پانچ)", "SHORT", 8, 2, { attemptAny: 5, rtl: true }),
      sec("سوال نمبر ۵: سبق کا خلاصہ یا نظم کا مرکزی خیال لکھیے۔", "LONG", 2, 5, { attemptAny: 1, rtl: true }),
      sec("سوال نمبر ۶: خط یا درخواست لکھیے۔", "LONG", 2, 10, { attemptAny: 1, rtl: true }),
      sec("سوال نمبر ۷: کسی ایک موضوع پر مضمون لکھیے۔", "LONG", 3, 10, { attemptAny: 1, rtl: true }),
      sec("سوال نمبر ۸: محاورات کو جملوں میں استعمال کیجیے / قواعد۔", "SHORT", 5, 1, { rtl: true }),
    ],
  },
  {
    key: "bise-islamiat",
    label: "BISE Punjab — Islamiat Compulsory (100 marks) · RTL",
    match: /^islamiat\b|^اسلامیات/i,
    levels: ["MATRIC"],
    totalMarks: 100,
    timeAllowed: "2:40 Hours",
    rtl: true,
    sections: [
      objective(20, "20 منٹ", true),
      sec("سوال نمبر ۲: درج ذیل سوالات کے مختصر جوابات لکھیے۔ (کوئی سے دس)", "SHORT", 14, 2, { attemptAny: 10, rtl: true, pageBreakBefore: true }),
      sec("سوال نمبر ۳: درج ذیل سوالات کے مختصر جوابات لکھیے۔ (کوئی سے دس)", "SHORT", 14, 2, { attemptAny: 10, rtl: true }),
      sec("سوال نمبر ۴: درج ذیل آیات کا ترجمہ و تشریح کیجیے۔ (کوئی سی دو)", "TRANSLATION", 3, 10, { attemptAny: 2, rtl: true }),
      sec("سوال نمبر ۵: درج ذیل احادیث کا ترجمہ کیجیے۔ (کوئی سی دو)", "TRANSLATION", 3, 5, { attemptAny: 2, rtl: true }),
      sec("سوال نمبر ۶: تفصیلی جواب لکھیے۔ (کوئی سا ایک)", "LONG", 2, 10, { attemptAny: 1, rtl: true }),
    ],
  },
  {
    key: "bise-tarjuma",
    label: "BISE Punjab — Tarjuma-tul-Quran (50 marks) · RTL",
    match: /tarjuma|ترجمۃ|ترجمہ/i,
    levels: ["MATRIC"],
    totalMarks: 50,
    timeAllowed: "2:00 Hours",
    rtl: true,
    sections: [
      objective(10, "15 منٹ", true),
      sec("سوال نمبر ۲: مختصر جوابات لکھیے۔ (کوئی سے پانچ)", "SHORT", 8, 2, { attemptAny: 5, rtl: true, pageBreakBefore: true }),
      sec("سوال نمبر ۳: درج ذیل آیات کا لفظی و بامحاورہ ترجمہ کیجیے۔ (کوئی سی چار)", "TRANSLATION", 6, 5, { attemptAny: 4, rtl: true }),
      sec("سوال نمبر ۴: گرامر / الفاظ کے معانی لکھیے۔ (کوئی سے دو)", "SHORT", 3, 5, { attemptAny: 2, rtl: true }),
    ],
  },
];

/** Finds the BISE Punjab preset for a subject at a given class level (e.g. 9th "Physics" → bise-science). */
export function findSubjectTemplate(subjectName: string | undefined | null, level: Level | undefined | null) {
  if (!subjectName || !level) return null;
  return SUBJECT_TEMPLATES.find((t) => t.levels.includes(level) && t.match.test(subjectName.trim())) ?? null;
}
