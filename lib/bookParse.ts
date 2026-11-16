// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * Textbook structure detection — pure functions, no dependencies (runs in the browser, testable in Node).
 *   pages (text per PDF page) → chapters → topics (1.1, 1.2 …) → exercises → numbered questions
 * Everything detected is shown to the uploader for review before it is saved.
 *
 * v1.7: Urdu numbering (۱۔) and options ((الف) (ب) (ج) (د)), questions without an "Exercise" heading
 * ("General Questions"), wrapped/hyphenated lines, more publisher watermarks and OCR noise.
 */
import type { QType } from "./types";

export interface RawPage { pageNo: number; text: string }

export interface ParsedItem {
  tempId: string;
  qNo: string; // as printed: "3", "iv", "2(iii)"
  pageNo: number;
  type: QType;
  text: string;
  options?: string[] | null;
  correctOption?: number | null;
  answer?: string | null;
  topic?: string | null;
  source: "EXERCISE" | "GENERATED" | "MANUAL";
}
export interface ParsedExercise { tempId: string; title: string; startPage: number; endPage: number; items: ParsedItem[] }
export interface ParsedChapter { tempId: string; number: number; title: string; startPage: number; endPage: number; topics: string[]; exercises: ParsedExercise[] }
export interface ChapterStart { number: number; title: string; startPage: number }

/** Title of the exercise that collects numbered questions found outside any "Exercise" heading. */
export const GENERAL_EXERCISE = "General Questions";

let seq = 0;
const tid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/* ---------------------------- characters ---------------------------- */
const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const ARABIC_DIGITS = "٠١٢٣٤٥٦٧٨٩";
/** Urdu/Arabic digits → ASCII, one character for one character (so match positions stay the same). */
const toAscii = (s: string) => s.replace(/[۰-۹٠-٩]/g, (d) => String(URDU_DIGITS.includes(d) ? URDU_DIGITS.indexOf(d) : ARABIC_DIGITS.indexOf(d)));
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 };
const numOf = (s: string) => (/^\d+$/.test(s) ? Number(s) : ROMAN[s.toLowerCase()] ?? NaN);
const AR = "؀-ۿݐ-ݿ";
/** "end of an Urdu word" — JS \b does not work after Arabic-script letters */
const UR_END = `(?![${AR}])`;

const LIGATURES: Record<string, string> = { "ﬀ": "ff", "ﬁ": "fi", "ﬂ": "fl", "ﬃ": "ffi", "ﬄ": "ffl", "ﬅ": "st", "ﬆ": "st" };
/**
 * Repairs characters PDFs often produce: ligatures (ﬁ → fi), Arabic presentation forms (ﻛ → ک),
 * soft hyphens at a line end (→ "-", so the wrap is joined later), NUL/control characters.
 */
export function fixChars(s: string): string {
  return s
    .replace(/[ﬀ-ﬆ]/g, (c) => LIGATURES[c] ?? c)
    .replace(/[ﭐ-﷿ﹰ-ﻼ]+/g, (m) => m.normalize("NFKC"))
    .replace(/­\s*$/, "-")
    // invisible direction marks (OCR puts them around Urdu numbers) would break "۱۔" / "(الف)" matching
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F­﻿�​‎‏‪-‮⁦-⁩]/g, "");
}

/* ---------------------------- patterns ---------------------------- */
const CHAPTER_EN = /^(?:chapter|unit|lesson|ch\.)\s*[-:#.]?\s*(\d{1,2}|[ivxIVX]{1,5})\b\s*[:.\-–—]?\s*(.*)$/i;
const CHAPTER_EN_TAIL = /^(?:chapter|unit)\s+([A-Z][A-Za-z ,&'\-]{3,80}?)\s+(\d{1,2})$/i; // "UNIT Entrepreneurship in Digital Age 12"
const SECTION_END = /^(?:student\s+learning\s+outcomes|learning\s+outcomes|slos?\b|by\s+the\s+end\s+of\s+this\s+(?:chapter|unit|lesson)|key\s+points|summary\b|glossary\b|حاصلات\s*تعلم|خلاصہ)/i;
const CHAPTER_UR = /^(?:باب|سبق|یونٹ)\s*(?:نمبر)?\s*[:\-–]?\s*(\d{1,2})\s*[:.\-–—۔]?\s*(.*)$/; // tested on toAscii(line)
const TOPIC = /^(\d{1,2})\.(\d{1,2})(?:\.\d{1,2})?\s+([A-Za-z؀-ۿ(].{2,90})$/;
const EXERCISE_EN = /^(?:exercise|review\s+exercise|review\s+questions|end[- ]of[- ](?:chapter|unit|lesson)\s+(?:exercises?|questions|review)|practice\s+questions|activities|self[- ]assessment|test\s+yourself|unit\s+review|chapter\s+review|check\s+your\s+(?:understanding|progress)|questions|assessment|worksheet)\b\s*([\d.]*)\s*[:.\-–]?\s*(.{0,50})$/i;
const EXERCISE_UR = new RegExp(`^(?:مشق|مشقی\\s*سوالات|سوالات|سرگرمیاں|جائزہ|اعادہ)${UR_END}\\s*([\\d.]*)\\s*(.{0,40})$`);
const ANSWER_HDR = new RegExp(`^(?:answers?(?:\\s+keys?)?\\b|answer\\s+to\\s+mcqs\\b|key\\s+to\\s+(?:mcqs|the\\s+exercise|exercise)\\b|mcqs?\\s+answers?\\b|جوابات${UR_END}|جواب\\s*نامہ${UR_END}|درست\\s+جوابات${UR_END})\\s*[:\\-–]?\\s*(.*)$`, "i");
const UR_LETTER: Record<string, string> = { "الف": "a", "ب": "b", "ج": "c", "د": "d" };
const ANSWER_TOKEN = new RegExp(`\\(?\\s*([ivxIVX]{1,6}|\\d{1,3})\\s*[).:\\-۔،]?\\s*[(\\)]?\\s*([a-dA-D]|الف|ب|ج|د)\\s*[)(]?(?![a-zA-Z${AR}])`, "g");

/** "1. b  2. (c)  (iii) a  ۱۔ ب" → [["1","b"],["2","c"],["iii","a"],["1","b"]] */
export function parseAnswerTokens(line: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of toAscii(line).matchAll(ANSWER_TOKEN)) out.push([m[1].toLowerCase(), UR_LETTER[m[2]] ?? m[2].toLowerCase()]);
  return out;
}

/**
 * Applies a chapter's answer key to its MCQs: first by question number ("1(ii)" ↔ "ii", "3" ↔ "3"),
 * otherwise in order when the key has exactly one answer per MCQ.
 */
export function applyAnswerKey(mcqs: ParsedItem[], key: [string, string][]) {
  if (!key.length || !mcqs.length) return 0;
  const byNo = new Map(key.map(([n, a]) => [n, a]));
  let set = 0;
  const lastPart = (q: string) => (toAscii(q).match(/\(([ivx]+|\d+)\)$/i)?.[1] ?? toAscii(q)).toLowerCase();
  for (const it of mcqs) {
    const a = byNo.get(lastPart(it.qNo)) ?? byNo.get(toAscii(it.qNo).toLowerCase());
    if (a) { it.correctOption = "abcd".indexOf(a); set++; }
  }
  // numbering didn't line up (or repeated numbers) → fall back to order when counts match
  if (set < mcqs.length && key.length === mcqs.length) {
    mcqs.forEach((it, i) => { it.correctOption = "abcd".indexOf(key[i][1]); });
    set = mcqs.length;
  }
  return set;
}

// Question numbers are matched on toAscii(line), so "۳۔" works like "3."
const Q_PREFIX = /^\s*Q\.?\s*(\d{1,3})\s*[.):\-۔،]?\s+(\S.*)$/i;
const Q_PREFIX_UR = /^\s*سوال\s*(?:نمبر)?\s*(\d{1,3})\s*[.):\-۔،]?\s*(\S.*)$/;
const Q_NUM = /^\s*\(?\s*(\d{1,3})\s*(?:[):\-۔،]|\.(?!\d))\s*(\S.*)$/;
const Q_ROMAN = /^\s*(?:\(\s*([ivxIVX]{1,6})\s*\)|([ivxIVX]{1,6})[.)])\s*(\S.*)$/;
const OPT_LINE = /^\s*\(?\s*([a-dA-D])\s*[).]\s*(\S.*)$/;
const OPT_LINE_UR = /^\s*[(\)]\s*(الف|ب|ج|د)\s*[)(]\s*(\S.*)$/;

/** "3. Define …", "Q3 …", "(iv) …", "۳۔ …", "سوال نمبر ۳: …" → number + question text (original digits kept). */
export function matchQuestionStart(line: string): { raw: string; text: string } | null {
  const a = toAscii(line);
  const m = a.match(Q_PREFIX) ?? a.match(Q_PREFIX_UR) ?? a.match(Q_NUM);
  if (m) return { raw: m[1], text: line.slice(line.length - m[2].length).trim() };
  const r = a.match(Q_ROMAN);
  if (r) return { raw: r[1] ?? r[2], text: line.slice(line.length - r[3].length).trim() };
  return null;
}

/**
 * OCR sometimes misreads an Urdu question number ("۲۔" → "LY", "5"): an Urdu line that starts with a short
 * Latin/digit token and ends like a question is still treated as a new question.
 */
function ocrQuestionStart(line: string): { raw: string; text: string } | null {
  const m = toAscii(line).match(/^([A-Za-z0-9]{1,3})[.)\-۔]?\s+(\S.*)$/);
  if (!m || !/[\u0600-\u06FF]/.test(m[2]) || !/[?؟]$|(?:کریں|کیجیے|لکھیں|لکھیے|بتائیں)[۔.]?$/.test(m[2])) return null;
  return { raw: /^\d+$/.test(m[1]) ? m[1] : "", text: line.slice(line.length - m[2].length).trim() };
}

/** "(b) Keyboard", "b) Keyboard", "(ب) مائع" → option letter (a–d) + text. */
export function matchOptionLine(line: string): { letter: string; text: string } | null {
  const m = line.match(OPT_LINE);
  if (m) return { letter: m[1].toLowerCase(), text: m[2].trim() };
  const u = line.match(OPT_LINE_UR);
  return u ? { letter: UR_LETTER[u[1]], text: u[2].trim() } : null;
}

export const HINTS: [QType, RegExp][] = [
  ["MCQ", /multiple[- ]choice|mcqs?\b|choose\s+the\s+(?:correct|right|best)|encircle|tick\s+\(?✓?\)?\s*the\s+correct|select\s+the\s+correct|درست\s*جواب|کثیر\s*الانتخابی|معروضی\s*سوالات/i],
  ["FILL_BLANK", /fill\s+in\s+the\s+blanks?|complete\s+the\s+(?:sentences|following)|خالی\s*جگہ/i],
  ["TRUE_FALSE", /true\s*(?:\/|or)\s*false|write\s+t\s+for|درست\s*(?:\/|یا)\s*غلط/i],
  ["MATCH_COLUMNS", /match\s+the\s+(?:columns?|following)|کالم\s*ملائیں/i],
  ["NUMERICAL", /numerical|problems?\b|solve\s+the\s+following|حل\s*کریں/i],
  ["LONG", /long\s+(?:answer\s+)?questions?|answer\s+in\s+detail|extensive|constructed\s+response|explain\s+in\s+detail|تفصیلی\s*سوالات|انشائیہ\s*سوالات/i],
  ["SHORT", /short\s+(?:answer\s+)?questions?|answer\s+the\s+following|give\s+short\s+answers?|مختصر\s*سوالات|مختصر\s*جواب/i],
];
export const hintOf = (s: string): QType | null => HINTS.find(([, re]) => re.test(s))?.[0] ?? null;

/* ---------------------------- options ---------------------------- */
interface OptTok { at: number; end: number; letter: string; bare: boolean }
const OPT_TOKEN = /\(\s*([a-dA-D])\s*\)|[(\)]\s*(الف|ب|ج|د)\s*[)(]|(^|\s)([a-dA-D])\)(?=\s)/g;
function optionTokens(s: string): OptTok[] {
  const out: OptTok[] = [];
  for (const m of s.matchAll(OPT_TOKEN)) {
    const lead = m[3] ?? "";
    out.push({ at: m.index! + lead.length, end: m.index! + m[0].length, letter: m[1] ? m[1].toLowerCase() : m[2] ? UR_LETTER[m[2]] : m[4].toLowerCase(), bare: !!m[4] });
  }
  return out;
}

/**
 * Options written on one line: "(a) X (b) Y (c) Z (d) W", "a) X b) Y", "(الف) … (ب) …".
 * Letters must run in order; a line that *starts* with options may hold just two of them
 * ("(a) … (b) …" / "c) … d) …").
 */
export function splitInlineOptions(s: string): { stem: string; opts: string[]; start: number } | null {
  const toks = optionTokens(s);
  if (toks.length < 2) return null;
  const start = "abcd".indexOf(toks[0].letter);
  if (toks.some((t, i) => "abcd".indexOf(t.letter) !== start + i)) return null;
  const stem = s.slice(0, toks[0].at).trim();
  if (stem && start !== 0) return null;
  const opts = toks.map((t, i) => s.slice(t.end, toks[i + 1]?.at ?? s.length).trim());
  return opts.length >= 3 || (!stem && opts.length >= 2) ? { stem, opts, start } : null;
}
const splitInline = splitInlineOptions;

/* ---------------------- header / footer cleaning ---------------------- */
const PAGE_NO = /^(?:page|p\.|pg\.?|صفحہ)?\s*[-–—(\[]?\s*[\d۰-۹]{1,4}\s*[-–—)\]]?(?:\s*(?:of|\/|از)\s*[\d۰-۹]{1,4})?$/i;
const STRUCTURAL = (l: string) => {
  const a = toAscii(l);
  return CHAPTER_EN.test(l) || CHAPTER_EN_TAIL.test(l) || CHAPTER_UR.test(a) || TOPIC.test(l) || EXERCISE_EN.test(l) || EXERCISE_UR.test(a) || !!matchQuestionStart(l) || !!matchOptionLine(l) || !!hintOf(l);
};
/**
 * Book watermarks/footers that pdf text often glues into a body line ("… today's digital PCTB Not for Sale world.").
 * Add a new publisher's watermark here, then press ♻️ Re-read questions on its books.
 */
const WATERMARK = new RegExp(
  [
    String.raw`\b(?:PCTB\s*[-–|:]?\s*)?Not\s+for\s+Sale\b`,
    String.raw`\b(?:For\s+)?Free\s+Distribution(?:\s+Only)?\b`,
    String.raw`\bFree\s+of\s+Cost\b`,
    String.raw`\bSale\s+(?:is\s+)?Prohibited\b`,
    String.raw`\bPunjab\s+Curriculum\s+(?:and|&)\s+Text\s?book\s+Board(?:\s*,?\s*Lahore)?\b`,
    String.raw`\b(?:Punjab|Khyber\s+Pakhtunkhwa|KP|Sindh|Balochistan)\s+Text\s?book\s+Board(?:\s*,?\s*(?:Lahore|Peshawar|Jamshoro|Quetta))?\b`,
    String.raw`\bNational\s+Book\s+Foundation\b`,
    String.raw`\b(?:https?:\/\/)?(?:www\.)?(?:pctb|ptb|kptbb|stbb|bobp|nbf)\.[\w./-]+`,
    String.raw`\b(?:PCTB|KPTBB|STBB|BTBB)\b`,
    // Urdu: "برائے فروخت نہیں", "مفت تقسیم کے لیے", "پنجاب کریکولم اینڈ ٹیکسٹ بک بورڈ"
    String.raw`(?:برائے|قابل)\s*فروخت\s*نہیں`,
    String.raw`(?:برائے\s*)?مفت\s*تقسیم(?:\s*کے\s*لی[ےئ])?`,
    String.raw`پنجاب\s*(?:کریکولم\s*(?:اینڈ|و)\s*)?ٹیکسٹ\s*بک\s*بورڈ(?:\s*،?\s*لاہور)?`,
  ].join("|"),
  "gi",
);
export const stripWatermarks = (s: string) => {
  if (s.search(WATERMARK) < 0) return s;
  return s
    .replace(WATERMARK, " ")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\s+([?.,;:!؟۔،])/g, "$1")
    .replace(/^[\s\-–—|•·:,]+|[\s–—|•·,]+$/g, "")
    .trim();
};
const footerKey = (l: string) => toAscii(l).toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

/** One line cleaned of watermarks, OCR noise symbols and copyright lines ("" = drop the line). */
export function cleanLine(raw: string): string {
  let l = stripWatermarks(fixChars(raw).replace(/\s+/g, " ").trim());
  if (l.length < 120 && /^[\s|•·]*(?:©|copyright\b)|all\s+rights\s+reserved/i.test(l)) return "";
  // stray OCR / layout symbols standing alone between words ("|", "•", "©", "»")
  l = l.replace(/(^|\s)[|¦`•·»«©®¬¤§¨†‡¶]+(?=\s|$)/g, "$1").replace(/\s{2,}/g, " ").trim();
  if (!/[\p{L}\p{N}]/u.test(l) && !/_{3,}/.test(l)) return "";
  return l;
}
/** Removes a dangling separator left after a footer or page number was taken out ("Computer Science 9 —"). */
const tidyEnd = (l: string) => l.replace(/\s+[–—|•·]+$|\s+-$/, "").trim();

/**
 * Removes running headers/footers ("PCTB Not for Sale", book title, "Unit 3 | 45") and bare page numbers,
 * so they never get glued onto questions or options.
 */
export function cleanPages(pages: RawPage[]): RawPage[] {
  const base = pages.map((p) => ({ pageNo: p.pageNo, ls: lines(p).map(cleanLine).filter(Boolean) }));
  const offset = printedPageOffset(base);
  const done = base.map((p) => {
    const printed = offset == null ? null : String(p.pageNo + offset);
    return {
      pageNo: p.pageNo,
      ls: p.ls.map((l) => (printed && !HEADING(l) ? stripPageNo(l, printed) : l)).map(tidyEnd).filter((l) => l && !PAGE_NO.test(l)),
    };
  });
  // count on the cleaned lines, so a footer counts the same whether or not its watermark/page number was removed
  const count = new Map<string, number>();
  for (const p of done) for (const k of new Set(p.ls.map(footerKey))) count.set(k, (count.get(k) ?? 0) + 1);
  // count only pages that have text: after a Smart OCR upload many pages are still empty (read chapter by chapter later)
  const withText = done.filter((p) => p.ls.length).length;
  const minRepeat = withText >= 3 && withText < 16 ? 3 : Math.max(4, Math.ceil(withText * 0.25));
  return done.map((p) => ({
    pageNo: p.pageNo,
    text: p.ls.filter((l) => STRUCTURAL(l) || l.length > 90 || (count.get(footerKey(l)) ?? 0) < minRepeat).join("\n"),
  }));
}

/** Removes the printed page number when it sits at the start or end of a line ("… business plan? 259", "240 credentials"). */
function stripPageNo(l: string, printed: string) {
  const esc = printed.replace(/\D/g, "");
  return l.replace(new RegExp(`^${esc}\\s+(?=\\S)`), "").replace(new RegExp(`(\\S)\\s+${esc}$`), "$1").trim();
}

/**
 * Printed page numbers usually run as (PDF page + a fixed offset). Finds that offset from numbers that sit
 * at the start or end of lines on many pages; null when there is no clear pattern.
 */
function printedPageOffset(pages: { pageNo: number; ls: string[] }[]): number | null {
  if (pages.length < 4) return null;
  const votes = new Map<number, number>();
  for (const p of pages) {
    const seen = new Set<number>();
    for (const raw of p.ls) {
      const l = toAscii(raw);
      if (HEADING(raw)) continue; // "Chapter 3", "UNIT … 12", "3.1 Topic" carry their own numbers
      const alone = PAGE_NO.test(l); // a number on its own line counts double
      for (const m of [l.match(/^(\d{1,4})(?:\s|$)/), l.match(/(?:^|\s)(\d{1,4})$/)]) {
        if (!m) continue;
        const d = Number(m[1]) - p.pageNo;
        if (d < -20 || d > 600 || seen.has(d)) continue;
        seen.add(d);
        votes.set(d, (votes.get(d) ?? 0) + (alone ? 2 : 1));
      }
    }
  }
  let best: [number, number] | null = null;
  for (const v of votes.entries()) if (!best || v[1] > best[1]) best = v;
  return best && best[1] >= Math.max(3, pages.length * 0.3) ? best[0] : null;
}
function HEADING(l: string) {
  return CHAPTER_EN.test(l) || CHAPTER_EN_TAIL.test(l) || CHAPTER_UR.test(toAscii(l)) || TOPIC.test(l);
}

const lines = (p: RawPage) => p.text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

/* ---------------------- boundaries & line joining ---------------------- */
const HEADING_WORDS = /^(?:key\s+(?:terms|points|words|concepts)|summary|glossary|introduction|objectives?|activity|activities|do\s+you\s+know\??|did\s+you\s+know\??|note|remember|points\s+to\s+remember|fact\s+file|think\s+about\s+it|teacher'?s?\s+(?:guide|note)|review|recap|اہم\s+نکات|یاد\s+رکھیے|سرگرمی|تعارف)$/i;
/** A side/section heading inside the text ("KEY TERMS", "Do you know?", "INTRODUCTION") — never part of a question. */
function isHeadingLike(l: string) {
  if (HEADING_WORDS.test(l)) return true;
  if (l.length > 40 || /\d/.test(l) || /[.?!:;,؟۔،]$/.test(l)) return false;
  const letters = l.replace(/[^A-Za-z]/g, "");
  return letters.length >= 4 && letters === letters.toUpperCase() && l.split(" ").length <= 5;
}
const words = (l: string) => l.split(/\s+/).filter(Boolean).length;
/** A full prose sentence (body text / passage), not the tail of a question. */
const isProse = (l: string, minWords = 8) => (words(l) >= minWords && /[.۔]$/.test(l)) || l.length > 110;
const QUESTION_WORD = /^(?:what|why|how|when|where|which|who|whom|whose|define|explain|describe|discuss|write|state|name|list|enlist|differentiate|distinguish|compare|give|identify|mention|elaborate|justify|prove|solve|find|calculate|compute|draw|label|fill|choose|select|encircle|tick|match|translate|summari[sz]e|outline|illustrate|evaluate|derive|show|convert|construct|is|are|do|does|did|can|could|will|would|should)\b/i;
const QUESTION_UR = /^(?:کیا|کیوں|کیسے|کب|کہاں|کون|کس|کتن[اےی])\s|(?:بیان|وضاحت|تعریف|فرق|ترجمہ|خلاصہ)\s+(?:کریں|کیجیے|کیجئے|لکھیں|لکھیے)|(?:لکھیں|لکھیے|بتائیں|بتائیے|کریں|کیجیے|کیجئے)\s*[۔.]?$/;
/** Looks like a question / exam item (not a numbered statement from the chapter text). */
function isQuestionLike(t: string): boolean {
  const first = t.match(/^[^?؟۔]{3,}[?؟۔]/)?.[0]; // OCR can glue a stray footer after the question
  if (first && first.length < t.length && isQuestionLike(first)) return true;
  return /[?؟]\s*$/.test(t) || QUESTION_WORD.test(t) || QUESTION_UR.test(t) || /:\s*$/.test(t) || /_{3,}|\.{4,}|…/.test(t);
}
/** Joins a wrapped line: "infor-" + "mation" → "information"; otherwise with one space. */
function joinWrap(a: string, b: string) {
  if (/[A-Za-z]-$/.test(a) && /^[a-z]/.test(b)) return a.slice(0, -1) + b;
  return `${a} ${b}`;
}

/* ---------------------------- chapters ---------------------------- */
export function detectChapterStarts(rawPages: RawPage[]): ChapterStart[] {
  const pages = cleanPages(rawPages);
  const out: ChapterStart[] = [];
  let last = 0;
  for (const p of pages) {
    const ls = lines(p);
    const head = ls.slice(0, 10);
    const hits = ls.filter((l) => CHAPTER_EN.test(l) || CHAPTER_EN_TAIL.test(l) || CHAPTER_UR.test(toAscii(l)));
    if (hits.length >= 3) continue; // table of contents page
    for (let i = 0; i < head.length; i++) {
      const l = head[i];
      const tail = l.match(CHAPTER_EN_TAIL);
      const ur = toAscii(l).match(CHAPTER_UR);
      const m = l.match(CHAPTER_EN) ?? (ur ? [l, ur[1], l.slice(l.length - ur[2].length)] : null) ?? (tail ? [l, tail[2], tail[1]] : null);
      if (!m) continue;
      const n = numOf(m[1]);
      if (!Number.isFinite(n) || n <= last || (last > 0 && n > last + 3) || n > 40) continue; // running heads repeat; skip jumps
      let title = m[2].trim();
      if (!title || title.length < 2) title = head[i + 1] ?? `Chapter ${n}`;
      title = title.replace(/\s*\.{3,}\s*\d+$/, "").slice(0, 120).trim() || `Chapter ${n}`;
      out.push({ number: n, title, startPage: p.pageNo });
      last = n;
      break;
    }
  }
  return out;
}

/* ---------------------------- full parse ---------------------------- */
export function parseBook(rawPages: RawPage[], starts?: ChapterStart[]): ParsedChapter[] {
  if (!rawPages.length) return [];
  const pages = cleanPages(rawPages);
  const sorted = [...pages].sort((a, b) => a.pageNo - b.pageNo);
  const lastPage = sorted[sorted.length - 1].pageNo;
  let cs = (starts ?? detectChapterStarts(sorted)).slice().sort((a, b) => a.startPage - b.startPage);
  if (!cs.length) cs = [{ number: 1, title: "Full book", startPage: sorted[0].pageNo }];

  return cs.map((c, ci) => {
    const endPage = ci + 1 < cs.length ? Math.max(c.startPage, cs[ci + 1].startPage - 1) : lastPage;
    const chPages = sorted.filter((p) => p.pageNo >= c.startPage && p.pageNo <= endPage);
    const ch: ParsedChapter = { tempId: tid("c"), number: c.number, title: c.title || `Chapter ${c.number}`, startPage: c.startPage, endPage, topics: [], exercises: [] };

    let ex = null as ParsedExercise | null;
    let general = null as ParsedExercise | null; // "General Questions": numbered questions without an Exercise heading
    let trusted = false; // the general section was opened by a heading like "Short questions" → keep every item
    let pending = null as { raw: string; text: string; pageNo: number } | null; // numbered stem that may turn out to be an MCQ
    let hint: QType | null = null;
    let topic: string | null = null;
    let cur = null as (ParsedItem & { opts: string[] }) | null;
    let group: string | null = null; // numeric parent for (i), (ii) items
    let inAnswers = false; // inside an "Answers / Answer key" block
    const answerKey: [string, string][] = [];
    const inGeneral = () => !!ex && ex === general;

    const flush = () => {
      if (!cur || !ex) { cur = null; return; }
      const it: ParsedItem & { opts?: string[] } = { ...cur };
      // "1. Discuss …" left after the printed number was read, and options glued into the stem
      it.text = it.text.replace(/^\s*(?:Q\.?\s*)?\(?(?:\d{1,3}|[ivx]{1,6})\s*[.):]\s+(?!\d)/i, "").trim();
      if (!cur.opts.length) {
        const inl = splitInline(it.text);
        if (inl && inl.stem && inl.opts.length >= 3) { it.text = inl.stem; cur.opts = inl.opts; }
      }
      const opts = cur.opts.map((o) => tidyEnd(o)).filter(Boolean);
      if (opts.length >= 3) { it.type = "MCQ"; it.options = opts.slice(0, 5); it.correctOption = null; }
      else {
        it.options = null;
        // 1–2 lettered parts are sub-parts ("(a) Define … (b) Explain …"), not MCQ options: keep them in the text
        if (opts.length) it.text += " " + opts.map((o, i) => `(${"abcd"[i]}) ${o}`).join(" ");
        if (hint && hint !== "MCQ" && hint !== "MATCH_COLUMNS") it.type = hint;
        else if (/_{3,}|\.{4,}|…/.test(it.text)) { it.type = "FILL_BLANK"; it.text = it.text.replace(/\.{4,}|…+/g, "_____"); }
        else it.type = it.text.length > 200 ? "LONG" : "SHORT";
      }
      it.text = tidyEnd(it.text);
      delete it.opts;
      // outside a real exercise, numbered chapter statements ("1. Simplex mode allows …") are not questions
      const keep = it.text.trim().length >= 3 && (!inGeneral() || trusted || it.type === "MCQ" || isQuestionLike(it.text));
      if (keep) ex.items.push(it);
      cur = null;
    };
    const closeExercise = () => { flush(); ex = null; hint = null; group = null; trusted = false; pending = null; };
    const openGeneral = (pageNo: number, byHeading: boolean) => {
      flush();
      if (!general) {
        general = { tempId: tid("e"), title: GENERAL_EXERCISE, startPage: pageNo, endPage: pageNo, items: [] };
        ch.exercises.push(general);
      }
      ex = general;
      trusted = byHeading;
      if (!byHeading) hint = null;
    };
    const startQuestion = (q: { raw: string; text: string }, pageNo: number) => {
      flush();
      const raw = toAscii(q.raw.replace(/^Q\.?\s*/i, ""));
      const isRoman = /^[ivx]+$/i.test(raw);
      const qNo = isRoman && group ? `${group}(${raw.toLowerCase()})` : raw;
      if (!isRoman) group = null;
      const inline = splitInline(q.text);
      cur = { tempId: tid("q"), qNo, pageNo, type: "SHORT", text: inline ? inline.stem : q.text, opts: inline?.opts ?? [], topic, source: "EXERCISE" };
    };

    for (const p of chPages) {
      for (const l of lines(p)) {
        const ascii = toAscii(l);
        // chapter headings / running heads inside the range are skipped (chapters are already split)
        if (l.length < 90 && (CHAPTER_EN.test(l) || CHAPTER_EN_TAIL.test(l) || CHAPTER_UR.test(ascii))) continue;
        // the next unit's opening page ("Student Learning Outcomes", "By the end of this chapter …") ends the exercise
        if (l.length < 80 && SECTION_END.test(l)) { closeExercise(); continue; }
        const am = l.length < 140 ? l.match(ANSWER_HDR) : null;
        if (am) {
          closeExercise();
          inAnswers = true;
          answerKey.push(...parseAnswerTokens(am[1] ?? ""));
          continue;
        }
        if (inAnswers) {
          if (TOPIC.test(l) || EXERCISE_EN.test(l) || EXERCISE_UR.test(ascii)) inAnswers = false;
          else {
            const toks = parseAnswerTokens(l);
            if (toks.length) { answerKey.push(...toks); continue; }
            inAnswers = false;
          }
        }
        const tm = l.match(TOPIC);
        if (tm && Number(tm[1]) === c.number && l.length < 100) {
          closeExercise();
          topic = `${tm[1]}.${tm[2]} ${tm[3].trim()}`;
          if (!ch.topics.includes(topic)) ch.topics.push(topic);
          continue;
        }
        const em = l.length <= 70 ? l.match(EXERCISE_EN) ?? ascii.match(EXERCISE_UR) : null;
        if (em) {
          closeExercise();
          const title = l.replace(/[:.\-–]+$/, "").trim() || "Exercise";
          ex = { tempId: tid("e"), title, startPage: p.pageNo, endPage: p.pageNo, items: [] };
          ch.exercises.push(ex);
          hint = hintOf(l);
          continue;
        }

        const h = hintOf(l);
        const qm = matchQuestionStart(l) ?? ocrQuestionStart(l);
        const om = matchOptionLine(l);
        // "2. Answer the following:" is a heading; "5. Choose the correct option: The full form of URL is" is a question
        const isTypeHeading = !!h && l.length < 80 && (!qm || qm.text.length < 70) && !/[?؟]$/.test(l) && !/:\s*\S+(?:\s+\S+){2,}/.test(l);

        // No "Exercise" heading: questions still count, grouped under "General Questions"
        if (!ex) {
          if (isTypeHeading) { openGeneral(p.pageNo, true); hint = h; group = qm && /^\d+$/.test(toAscii(qm.raw)) ? toAscii(qm.raw) : null; continue; }
          if (qm && (isQuestionLike(qm.text) || (splitInline(qm.text)?.opts.length ?? 0) >= 3)) openGeneral(p.pageNo, false);
          else if (om && pending) { openGeneral(pending.pageNo, false); startQuestion(pending, pending.pageNo); }
          else { pending = qm ? { ...qm, pageNo: p.pageNo } : null; continue; }
          pending = null;
        }
        if (!ex) continue;
        ex.endPage = p.pageNo;

        // sub-heading that sets the type, e.g. "A. Multiple choice questions" or "1. Fill in the blanks."
        const sectionLetter = /^\s*[A-H]\.\s/.test(l); // "B. Long questions." — a sub-heading, never option (b)
        if (isTypeHeading && (sectionLetter || !(cur && cur.opts.length && om))) {
          flush();
          hint = h;
          if (inGeneral()) trusted = true;
          group = qm && /^\d+$/.test(toAscii(qm.raw)) ? toAscii(qm.raw) : null;
          continue;
        }
        // side headings ("KEY TERMS", "Do you know?") end the question before them
        if (isHeadingLike(l) && !qm && !om) {
          flush();
          if (inGeneral()) ex = null;
          continue;
        }
        if (cur && om) {
          const all = splitInline(l);
          if (all && !all.stem) cur.opts.push(...all.opts);
          else cur.opts.push(om.text);
          continue;
        }
        if (qm) { startQuestion(qm, p.pageNo); continue; }
        if (cur) {
          const inline = splitInline(l);
          const last = cur.opts[cur.opts.length - 1] ?? "";
          if (inline && (!inline.stem || cur.opts.length === 0)) {
            if (inline.stem) cur.text = joinWrap(cur.text, inline.stem);
            cur.opts.push(...inline.opts);
          } else if (cur.opts.length >= 3) {
            // wrapped option ("… protects your infor-" / "mation") belongs to the last option;
            // anything else after a complete MCQ (side note, next paragraph) is not part of it
            const wrapped = l.length < 90 && last.length < 200 && (/^[a-z0-9(,;]/.test(l) || last.length >= 30 || /-$/.test(last) || words(l) <= 4);
            if (wrapped) cur.opts[cur.opts.length - 1] = joinWrap(last, l);
            else { flush(); if (inGeneral()) ex = null; }
          } else if (cur.opts.length && l.length < 90 && last.length < 200) {
            cur.opts[cur.opts.length - 1] = joinWrap(last, l);
          } else if (/[?؟]$/.test(cur.text) && isProse(l, inGeneral() ? 8 : 12) && !/^[a-z]/.test(l)) {
            // a full paragraph after a finished question is chapter text / a passage, not part of the question
            flush();
            if (inGeneral()) ex = null;
          } else if (inGeneral() && !trusted && isProse(l) && /[.۔]$/.test(cur.text)) {
            flush();
            ex = null;
          } else if (inGeneral() && /[.?؟۔]$/.test(cur.text) && words(l) <= 3 && !/[.?!؟۔:]$/.test(l) && !/^[a-z]/.test(l)) {
            // a few loose words after a finished question (footer / OCR noise) are not part of it
          } else if (cur.text.length < 1500) cur.text = joinWrap(cur.text, l);
        } else if (inGeneral() && isProse(l)) {
          ex = null; // back in the chapter text
        }
      }
    }
    closeExercise();
    ch.exercises = ch.exercises.filter((e) => e.items.length > 0);
    // Answer key printed in the chapter → correct options for its MCQs
    applyAnswerKey(ch.exercises.flatMap((e) => e.items.filter((it) => it.type === "MCQ")), answerKey);
    return ch;
  });
}

/**
 * Exercise headings on a page: "start" = "EXERCISE" / "Review Questions" / "مشق" (where an exercise begins),
 * "section" = a question-type heading ("B. Short Questions", "Multiple Choice Questions") that can sit inside one.
 */
export function exerciseHeadingOf(text: string): "start" | "section" | null {
  let found: "start" | "section" | null = null;
  for (const raw of text.split(/\n+/)) {
    const l = cleanLine(raw);
    if (!l || l.length > 70) continue;
    if (EXERCISE_EN.test(l) || EXERCISE_UR.test(toAscii(l))) return "start";
    if (!!hintOf(l) && l.length < 60 && !/[?؟]$/.test(l)) found = "section";
  }
  return found;
}
export const hasExerciseHeading = (text: string) => exerciseHeadingOf(text) != null;

/**
 * Pages whose text is only a quick heading scan (ocrLevel 1: the top of a scanned page) are used to find chapters,
 * never to read questions — their questions would be cut off half-way.
 */
export const forParsing = <T extends RawPage & { ocrLevel?: number | null }>(pages: T[]): T[] => pages.map((p) => (p.ocrLevel === 1 ? { ...p, text: "" } : p));

/* --------------------- payload for PUT /api/books/:id/structure --------------------- */
const clip = (s: string | null | undefined, n: number) => (s == null ? null : fixChars(String(s)).slice(0, n));
/** Same limits as the API, so a save never fails on one over-long or odd line. */
export function structurePayload(chs: ParsedChapter[], isAlp?: (chapterNumber: number) => boolean | undefined) {
  return chs.slice(0, 150).map((c) => ({
    number: Math.max(0, Math.min(999, Math.round(c.number) || 0)),
    title: (clip(c.title, 200) ?? "").trim() || `Chapter ${c.number}`,
    startPage: Math.max(1, c.startPage),
    endPage: Math.max(1, c.startPage, c.endPage),
    topics: c.topics.slice(0, 200).map((t) => clip(t, 200) ?? ""),
    ...(isAlp ? { isAlp: isAlp(c.number) } : {}),
    exercises: c.exercises.slice(0, 300).map((e) => ({
      title: (clip(e.title, 200) ?? "").trim() || "Exercise",
      startPage: e.startPage,
      endPage: Math.max(e.startPage, e.endPage),
      items: e.items.slice(0, 800).map((it) => ({
        qNo: clip(it.qNo, 30) ?? "",
        pageNo: it.pageNo ?? null,
        type: it.type,
        text: clip(it.text, 5000) ?? "",
        options: it.options ? it.options.slice(0, 6).map((o) => clip(o, 1000) ?? "") : null,
        correctOption: it.correctOption != null && it.correctOption >= 0 && it.correctOption <= 5 ? it.correctOption : null,
        answer: clip(it.answer, 3000),
        topic: clip(it.topic, 200),
        source: it.source,
      })),
    })),
  }));
}

/* ------------------- free question generation (no AI) ------------------- */
/** Chapter text as paragraphs: wrapped lines joined, headings / questions / options kept apart. */
function paragraphs(text: string): string[] {
  const out: string[] = [];
  let cur = "";
  const push = () => { if (cur) out.push(cur); cur = ""; };
  for (const l of text.split(/\n+/).map((x) => x.trim()).filter(Boolean)) {
    const special = HEADING(l) || EXERCISE_EN.test(l) || EXERCISE_UR.test(toAscii(l)) || !!matchQuestionStart(l) || !!matchOptionLine(l) || isHeadingLike(l) || !!hintOf(l);
    if (special) { push(); out.push(""); continue; } // "" = a break that never yields a definition
    // a short line without an ending (a side title) starts its own block
    const shortTitle = l.length < 45 && !/[.?!:;,؟۔،-]$/.test(l) && words(l) <= 6;
    if (shortTitle) { push(); out.push(l); continue; }
    if (cur && /[.?!:؟۔]$/.test(cur)) push();
    cur = cur ? joinWrap(cur, l) : l;
  }
  push();
  return out.filter(Boolean);
}
const sentencesOf = (para: string) => para.match(/[^.!?۔؟]+[.!?۔؟]/g)?.map((s) => s.trim()).filter(Boolean) ?? [];

const DEF_EN = /^((?:(?:The|An|A)\s+)?([A-Za-z][A-Za-z\-']+(?:\s+[A-Za-z\-']+){0,3}?))\s+(is called|are called|is defined as|are defined as|is known as|are known as|refers to|refer to|means|is|are)\s+(.{12,220})\.$/;
const DEF_STARTS = /^(?:a|an|the|one|any|those|that|which|a\s+kind|a\s+type|known|called|defined)\b/i;
const NOT_TERM = /^(This|That|These|Those|It|They|There|Here|Which|What|Each|Some|All|One|He|She|We|You|I|Our|Their|His|Her|Its|Such|Many|Most|Few|Both|Every|In|On|At|For|By|If|When|So|But|And|Or)$/i;
const UR_JOIN = new Set(["ہے", "ہیں", "تھا", "تھے", "کو", "کا", "کی", "کے", "میں", "سے", "اور", "جو", "جس", "یہ", "وہ", "پر", "بھی", "ہی", "ہو", "کر"]);
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Builds review questions from definition-style sentences in the chapter text (English and Urdu):
 *   "Photosynthesis is the process by which …."  → Define Photosynthesis. / fill-in-the-blank / true-false
 *   "تبخیر سے مراد … ہے۔" · "… کے عمل کو انجماد کہتے ہیں۔" · "… تبخیر کہلاتا ہے۔"
 * Answers are the book's own sentences — nothing is invented.
 */
export function generateFromText(rawPages: RawPage[], chapter: { startPage: number; endPage: number }, max = 30): ParsedItem[] {
  const pages = cleanPages(rawPages).filter((p) => p.pageNo >= chapter.startPage && p.pageNo <= chapter.endPage);
  const out: ParsedItem[] = [];
  const seen = new Set<string>();
  const add = (pageNo: number, term: string, sentence: string, urdu: boolean) => {
    term = term.trim();
    const key = term.toLowerCase();
    if (!term || term.length > 40 || seen.has(key)) return;
    seen.add(key);
    const blank = (() => {
      const i = urdu ? sentence.lastIndexOf(term) : sentence.search(new RegExp(`\\b${esc(term)}\\b`));
      return i < 0 ? null : sentence.slice(0, i) + "_____" + sentence.slice(i + term.length);
    })();
    const Term = urdu ? term : term.charAt(0).toUpperCase() + term.slice(1);
    out.push({ tempId: tid("g"), qNo: "", pageNo, type: "SHORT", text: urdu ? `${term} کی تعریف کریں۔` : `Define ${Term}.`, answer: sentence, source: "GENERATED" });
    if (blank) out.push({ tempId: tid("g"), qNo: "", pageNo, type: "FILL_BLANK", text: blank, answer: term, source: "GENERATED" });
    out.push({ tempId: tid("g"), qNo: "", pageNo, type: "TRUE_FALSE", text: sentence, answer: urdu ? "درست" : "True", source: "GENERATED" });
  };
  for (const p of pages) {
    for (const para of paragraphs(p.text)) {
      for (const s of sentencesOf(para)) {
        if (out.length >= max * 3) break;
        if (s.length > 260) continue;
        const m = s.match(DEF_EN);
        if (m) {
          const term = m[2].trim().replace(/^(?:The|An|A)\s+/, "");
          const verb = m[3];
          if (NOT_TERM.test(term.split(" ")[0])) continue;
          if ((verb === "is" || verb === "are") && !DEF_STARTS.test(m[4])) continue; // "Computers are used …" is not a definition
          add(p.pageNo, term, s.replace(/\s+/g, " "), false);
          continue;
        }
        // Urdu definitions
        const u1 = s.match(/^(.{2,40}?)\s+سے\s+مراد\s+(.{8,220})[۔.]$/);
        if (u1) { add(p.pageNo, u1[1], s, true); continue; }
        const u2 = s.match(/^(.{6,200})\s+کو\s+(\S+(?:\s+\S+){0,2}?)\s+(?:کہتے|کہا\s*جاتا)\s*(?:ہیں|ہے)[۔.]$/);
        if (u2) { add(p.pageNo, u2[2], s, true); continue; }
        const u3 = s.match(/^(.{6,200})\s+کہلات(?:ا|ی|ے)\s*(?:ہے|ہیں)[۔.]$/);
        if (u3) {
          // the term is the last word, or the last two ("ضیائی تالیف") when the word before is not a joining word
          const w = u3[1].split(/\s+/);
          const two = w.length > 2 && !UR_JOIN.has(w[w.length - 2]);
          add(p.pageNo, two ? `${w[w.length - 2]} ${w[w.length - 1]}` : w[w.length - 1], s, true);
        }
      }
    }
  }
  // interleave types so the first N are varied
  const byType = ["SHORT", "FILL_BLANK", "TRUE_FALSE"].map((ty) => out.filter((o) => o.type === ty));
  const mixed: ParsedItem[] = [];
  for (let i = 0; mixed.length < Math.min(max, out.length); i++) for (const arr of byType) if (arr[i] && mixed.length < max) mixed.push(arr[i]);
  return mixed;
}

/** "1-5, 8, 10" → [1,2,3,4,5,8,10] (1-based positions) */
export function parseNumberList(s: string, max = 500): number[] {
  const out = new Set<number>();
  for (const part of s.split(/[,\s]+/).filter(Boolean)) {
    const r = part.match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (r) { const a = Number(r[1]), b = Number(r[2]); for (let i = Math.min(a, b); i <= Math.max(a, b) && i <= max; i++) out.add(i); }
    else if (/^\d+$/.test(part)) out.add(Number(part));
  }
  return [...out].sort((a, b) => a - b);
}
