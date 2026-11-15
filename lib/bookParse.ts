// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * Textbook structure detection — pure functions, no dependencies (runs in the browser, testable in Node).
 *   pages (text per PDF page) → chapters → topics (1.1, 1.2 …) → exercises → numbered questions
 * Everything detected is shown to the uploader for review before it is saved.
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

let seq = 0;
const tid = (p: string) => `${p}${Date.now().toString(36)}${(seq++).toString(36)}`;

/* ---------------------------- patterns ---------------------------- */
const URDU_DIGITS = "۰۱۲۳۴۵۶۷۸۹";
const toAscii = (s: string) => s.replace(/[۰-۹]/g, (d) => String(URDU_DIGITS.indexOf(d)));
const ROMAN: Record<string, number> = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 };
const numOf = (s: string) => (/^\d+$/.test(s) ? Number(s) : ROMAN[s.toLowerCase()] ?? NaN);

const CHAPTER_EN = /^(?:chapter|unit|lesson|ch\.)\s*[-:#.]?\s*(\d{1,2}|[ivxIVX]{1,5})\b\s*[:.\-–—]?\s*(.*)$/i;
const CHAPTER_EN_TAIL = /^(?:chapter|unit)\s+([A-Z][A-Za-z ,&'\-]{3,80}?)\s+(\d{1,2})$/i; // "UNIT Entrepreneurship in Digital Age 12"
const SECTION_END = /^(?:student\s+learning\s+outcomes|learning\s+outcomes|slos?\b|by\s+the\s+end\s+of\s+this\s+(?:chapter|unit|lesson)|key\s+points|summary\b|glossary\b)/i;
const CHAPTER_UR = /^(?:باب|سبق|یونٹ)\s*(?:نمبر)?\s*[:\-–]?\s*([\d۰-۹]{1,2})\s*[:.\-–—]?\s*(.*)$/;
const TOPIC = /^(\d{1,2})\.(\d{1,2})(?:\.\d{1,2})?\s+([A-Za-z؀-ۿ(].{2,90})$/;
const EXERCISE_EN = /^(?:exercise|review\s+exercise|review\s+questions|end[- ]of[- ](?:chapter|unit|lesson)\s+(?:exercises?|questions|review)|practice\s+questions|activities|self[- ]assessment|test\s+yourself|unit\s+review|chapter\s+review|check\s+your\s+(?:understanding|progress)|questions|assessment|worksheet)\b\s*([\d.]*)\s*[:.\-–]?\s*(.{0,50})$/i;
const EXERCISE_UR = /^(?:مشق|مشقی\s+سوالات|سوالات|سرگرمیاں|جائزہ)\b\s*([\d۰-۹.]*)\s*(.{0,40})$/;
const ANSWER_HDR = /^(?:answers?(?:\s+keys?)?|answer\s+to\s+mcqs|key\s+to\s+(?:mcqs|the\s+exercise|exercise)|mcqs?\s+answers?|جوابات|جواب\s*نامہ|درست\s+جوابات)\b\s*[:\-–]?\s*(.*)$/i;
const ANSWER_TOKEN = /\(?\s*([ivxIVX]{1,6}|\d{1,3})\s*[).:\-]?\s*\(?\s*([a-dA-D])\s*\)?(?![a-zA-Z])/g;

/** "1. b  2. (c)  (iii) a" → [["1","b"],["2","c"],["iii","a"]] */
export function parseAnswerTokens(line: string): [string, string][] {
  const out: [string, string][] = [];
  for (const m of line.matchAll(ANSWER_TOKEN)) out.push([m[1].toLowerCase(), m[2].toLowerCase()]);
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
  const lastPart = (q: string) => (q.match(/\(([ivx]+|\d+)\)$/i)?.[1] ?? q).toLowerCase();
  for (const it of mcqs) {
    const a = byNo.get(lastPart(it.qNo)) ?? byNo.get(it.qNo.toLowerCase());
    if (a) { it.correctOption = "abcd".indexOf(a); set++; }
  }
  // numbering didn't line up (or repeated numbers) → fall back to order when counts match
  if (set < mcqs.length && key.length === mcqs.length) {
    mcqs.forEach((it, i) => { it.correctOption = "abcd".indexOf(key[i][1]); });
    set = mcqs.length;
  }
  return set;
}

const Q_PREFIX = /^\s*Q\.?\s*(\d{1,3})\s*[.):\-]?\s+(.+)$/i;
const Q_START = /^\s*\(?\s*((?:Q\.?\s*)?\d{1,3}|[ivxIVX]{1,6})\s*[.):\-]\s*(.+)$/;
const OPT_LINE = /^\s*\(?\s*([a-dA-D])\s*[).]\s*(.+)$/;
const INLINE_OPT = /\(\s*([a-dA-D])\s*\)\s*/;

export const HINTS: [QType, RegExp][] = [
  ["MCQ", /multiple[- ]choice|mcqs?\b|choose\s+the\s+(?:correct|right|best)|encircle|tick\s+\(?✓?\)?\s*the\s+correct|select\s+the\s+correct|درست\s+جواب|کثیر\s+الانتخابی/i],
  ["FILL_BLANK", /fill\s+in\s+the\s+blanks?|complete\s+the\s+(?:sentences|following)|خالی\s+جگہ/i],
  ["TRUE_FALSE", /true\s*(?:\/|or)\s*false|write\s+t\s+for|درست\s*(?:\/|یا)\s*غلط/i],
  ["MATCH_COLUMNS", /match\s+the\s+(?:columns?|following)|کالم\s+ملائیں/i],
  ["NUMERICAL", /numerical|problems?\b|solve\s+the\s+following|حل\s+کریں/i],
  ["LONG", /long\s+(?:answer\s+)?questions?|answer\s+in\s+detail|extensive|constructed\s+response|explain\s+in\s+detail|تفصیلی\s+سوالات/i],
  ["SHORT", /short\s+(?:answer\s+)?questions?|answer\s+the\s+following|give\s+short\s+answers?|مختصر\s+سوالات|مختصر\s+جواب/i],
];
export const hintOf = (s: string): QType | null => HINTS.find(([, re]) => re.test(s))?.[0] ?? null;

function splitInline(s: string): { stem: string; opts: string[] } | null {
  let parts: string[];
  if (INLINE_OPT.test(s)) parts = s.split(/\(\s*([a-dA-D])\s*\)\s*/);
  else {
    // "a) Surveys b) Research c) Observation" — accepted only when the letters run a, b, c … in order
    parts = s.split(/(?:^|\s)([a-dA-D])\)\s+/);
    const letters = parts.filter((_, i) => i % 2 === 1).map((x) => x.toLowerCase());
    if (letters.length < 2 || letters.some((l, i) => l !== "abcd"[i])) return null;
  }
  const opts: string[] = [];
  for (let i = 1; i < parts.length; i += 2) opts.push((parts[i + 1] ?? "").trim());
  const stem = parts[0].trim();
  // A line that *starts* with options may hold just two of them: "(a) … (b) …" then "(c) … (d) …"
  return opts.length >= 3 || (!stem && opts.length >= 2) ? { stem, opts } : null;
}

/* ---------------------- header / footer cleaning ---------------------- */
const PAGE_NO = /^[-–—(\[]?\s*(?:page|p\.|صفحہ)?\s*[\d۰-۹]{1,4}\s*[-–—)\]]?$/i;
const STRUCTURAL = (l: string) => CHAPTER_EN.test(l) || CHAPTER_EN_TAIL.test(l) || CHAPTER_UR.test(toAscii(l)) || TOPIC.test(l) || EXERCISE_EN.test(l) || EXERCISE_UR.test(toAscii(l)) || Q_START.test(l) || OPT_LINE.test(l) || !!hintOf(l);
/** Book watermarks/footers that pdf text often glues into a body line ("… today's digital PCTB Not for Sale world."). */
const WATERMARK = /\b(?:PCTB\s*[-–|:]?\s*)?Not\s+for\s+Sale\b|\bFree\s+Distribution\b|\bPunjab\s+Curriculum\s+(?:and|&)\s+Text\s?book\s+Board\b|\bPCTB\b/gi;
export const stripWatermarks = (s: string) => (s.search(WATERMARK) < 0 ? s : s.replace(WATERMARK, " ").replace(/[ \t]{2,}/g, " ").replace(/\s+([?.,;:!])/g, "$1").trim());
const footerKey = (l: string) => toAscii(l).toLowerCase().replace(/\d+/g, "#").replace(/\s+/g, " ").trim();

/**
 * Removes running headers/footers ("PCTB Not for Sale", book title, "Unit 3 | 45") and bare page numbers,
 * so they never get glued onto questions or options.
 */
export function cleanPages(pages: RawPage[]): RawPage[] {
  const count = new Map<string, number>();
  for (const p of pages) for (const k of new Set(lines(p).map(footerKey))) count.set(k, (count.get(k) ?? 0) + 1);
  const minRepeat = Math.max(4, Math.ceil(pages.length * 0.25));
  const offset = printedPageOffset(pages);
  return pages.map((p) => {
    const printed = offset == null ? null : String(p.pageNo + offset);
    return {
      pageNo: p.pageNo,
      text: lines(p)
        .map((l) => stripWatermarks(l))
        .map((l) => (printed && !HEADING(l) ? stripPageNo(l, printed) : l))
        .filter((l) => l && !PAGE_NO.test(l))
        .filter((l) => STRUCTURAL(l) || l.length > 90 || (count.get(footerKey(l)) ?? 0) < minRepeat)
        .join("\n"),
    };
  });
}

/** Removes the printed page number when it sits at the start or end of a line ("… business plan? 259", "240 credentials"). */
function stripPageNo(l: string, printed: string) {
  const esc = printed.replace(/\D/g, "");
  return l.replace(new RegExp(`^${esc}\\s+(?=\\S)`), "").replace(new RegExp(`(?<=\\S)\\s+${esc}$`), "").trim();
}

/**
 * Printed page numbers usually run as (PDF page + a fixed offset). Finds that offset from numbers that sit
 * at the start or end of lines on many pages; null when there is no clear pattern.
 */
function printedPageOffset(pages: RawPage[]): number | null {
  if (pages.length < 4) return null;
  const votes = new Map<number, number>();
  for (const p of pages) {
    const seen = new Set<number>();
    for (const l of lines(stripAll(p))) {
      if (HEADING(l)) continue; // "Chapter 3", "UNIT … 12", "3.1 Topic" carry their own numbers
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
const stripAll = (p: RawPage): RawPage => ({ pageNo: p.pageNo, text: p.text.split(/\n+/).map(stripWatermarks).join("\n") });


const lines = (p: RawPage) => p.text.split(/\n+/).map((l) => l.replace(/\s+/g, " ").trim()).filter(Boolean);

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
      const m = l.match(CHAPTER_EN) ?? toAscii(l).match(CHAPTER_UR) ?? (tail ? [l, tail[2], tail[1]] : null);
      if (!m) continue;
      const n = numOf(toAscii(m[1]));
      if (!Number.isFinite(n) || n <= last || (last > 0 && n > last + 3) || n > 40) continue; // running heads repeat; skip jumps
      let title = m[2].trim();
      if (!title || title.length < 2) title = head[i + 1] ?? `Chapter ${n}`;
      title = title.replace(/\s*\.{3,}\s*\d+$/, "").slice(0, 120);
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
    const ch: ParsedChapter = { tempId: tid("c"), number: c.number, title: c.title, startPage: c.startPage, endPage, topics: [], exercises: [] };

    let ex: ParsedExercise | null = null;
    let hint: QType | null = null;
    let topic: string | null = null;
    let cur: (ParsedItem & { opts: string[] }) | null = null;
    let group: string | null = null; // numeric parent for (i), (ii) items
    let inAnswers = false; // inside an "Answers / Answer key" block
    const answerKey: [string, string][] = [];

    const flush = () => {
      if (!cur || !ex) { cur = null; return; }
      const it: ParsedItem & { opts?: string[] } = { ...cur };
      // "1. Discuss …" left after the printed number was read, and options glued into the stem
      it.text = it.text.replace(/^\s*(?:Q\.?\s*)?\(?(?:\d{1,3}|[ivx]{1,6})\s*[.):]\s+(?!\d)/i, "").trim();
      if (!cur.opts.length) {
        const inl = splitInline(it.text);
        if (inl && inl.stem && inl.opts.length >= 3) { it.text = inl.stem; cur.opts = inl.opts; }
      }
      const opts = cur.opts.filter(Boolean);
      if (opts.length >= 3) { it.type = "MCQ"; it.options = opts.slice(0, 5); it.correctOption = null; }
      else {
        it.options = null;
        // 1–2 lettered parts are sub-parts ("(a) Define … (b) Explain …"), not MCQ options: keep them in the text
        if (opts.length) it.text += " " + opts.map((o, i) => `(${"abcd"[i]}) ${o}`).join(" ");
        if (hint && hint !== "MCQ" && hint !== "MATCH_COLUMNS") it.type = hint;
        else if (/_{3,}|\.{4,}|…/.test(it.text)) { it.type = "FILL_BLANK"; it.text = it.text.replace(/\.{4,}|…+/g, "_____"); }
        else it.type = it.text.length > 200 ? "LONG" : "SHORT";
      }
      delete it.opts;
      if (it.text.trim().length >= 3) ex.items.push(it);
      cur = null;
    };
    const closeExercise = () => { flush(); ex = null; hint = null; group = null; };

    for (const p of chPages) {
      for (const l of lines(p)) {
        const ascii = toAscii(l);
        // chapter headings / running heads inside the range are skipped (chapters are already split)
        if (l.length < 90 && (CHAPTER_EN.test(l) || CHAPTER_EN_TAIL.test(l) || CHAPTER_UR.test(ascii))) continue;
        // the next unit's opening page ("Student Learning Outcomes", "By the end of this chapter …") ends the exercise
        if (l.length < 80 && SECTION_END.test(l)) { closeExercise(); continue; }
        const am = l.length < 140 ? l.match(ANSWER_HDR) ?? ascii.match(ANSWER_HDR) : null;
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
          const title = l.replace(/[:.\-–]+$/, "").trim();
          ex = { tempId: tid("e"), title, startPage: p.pageNo, endPage: p.pageNo, items: [] };
          ch.exercises.push(ex);
          hint = hintOf(l);
          continue;
        }
        if (!ex) continue;
        ex.endPage = p.pageNo;

        // sub-heading that sets the type, e.g. "A. Multiple choice questions" or "1. Fill in the blanks."
        const h = hintOf(l);
        const qm = l.match(Q_PREFIX) ?? l.match(Q_START);
        const sectionLetter = /^\s*[A-H]\.\s/.test(l); // "B. Long questions." — a sub-heading, never option (b)
        if (h && l.length < 80 && (!qm || qm[2].length < 70) && (sectionLetter || !(cur && cur.opts.length && OPT_LINE.test(l)))) {
          flush();
          hint = h;
          group = qm && /^\d+$/.test(qm[1].replace(/^Q\.?\s*/i, "")) ? qm[1].replace(/^Q\.?\s*/i, "") : null;
          continue;
        }
        const om = l.match(OPT_LINE);
        if (cur && om) {
          const all = splitInline(l);
          if (all && !all.stem) cur.opts.push(...all.opts);
          else cur.opts.push(om[2].trim());
          continue;
        }
        if (qm) {
          flush();
          const raw = qm[1].replace(/^Q\.?\s*/i, "");
          const isRoman = /^[ivx]+$/i.test(raw);
          const qNo = isRoman && group ? `${group}(${raw.toLowerCase()})` : raw;
          if (!isRoman) group = null;
          const inline = splitInline(qm[2]);
          cur = { tempId: tid("q"), qNo, pageNo: p.pageNo, type: "SHORT", text: inline ? inline.stem : qm[2].trim(), opts: inline?.opts ?? [], topic, source: "EXERCISE" };
          continue;
        }
        if (cur) {
          const inline = splitInline(l);
          if (inline && (!inline.stem || cur.opts.length === 0)) {
            if (inline.stem) cur.text += " " + inline.stem;
            cur.opts.push(...inline.opts);
          } else if (cur.opts.length && l.length < 90 && cur.opts[cur.opts.length - 1].length < 200) {
            // wrapped option ("… steal your" / "information") — it belongs to the option, not the question
            cur.opts[cur.opts.length - 1] += " " + l;
          } else if (cur.text.length < 1500) cur.text += " " + l;
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

/* ------------------- free question generation (no AI) ------------------- */
/**
 * Builds review questions from definition-style sentences in the chapter text:
 *   "Photosynthesis is the process by which …." → Define Photosynthesis. / fill-in-the-blank / true-false
 */
export function generateFromText(rawPages: RawPage[], chapter: { startPage: number; endPage: number }, max = 30): ParsedItem[] {
  const text = cleanPages(rawPages)
    .filter((p) => p.pageNo >= chapter.startPage && p.pageNo <= chapter.endPage)
    .map((p) => ({ pageNo: p.pageNo, t: p.text.replace(/[ \t]+/g, " ") }));
  const out: ParsedItem[] = [];
  const seen = new Set<string>();
  const DEF = /(?<=^|[.!?]\s|\n)((?:The |An |A )?([A-Z][A-Za-z\-']+(?:\s+[A-Za-z\-']+){0,3}))\s+(is|are|is called|are called|is defined as|are defined as|means|refers to|is known as)\s+([^.?!]{15,220})[.]/g;
  for (const { pageNo, t } of text) {
    let m: RegExpExecArray | null;
    while ((m = DEF.exec(t)) && out.length < max * 3) {
      const term = m[2].trim().replace(/^(?:The|An|A)\s+/, "");
      const key = term.toLowerCase();
      if (seen.has(key) || /^(This|That|These|Those|It|They|There|Here|Which|What|Each|Some|All|One|He|She|We|You)$/i.test(term.split(" ")[0])) continue;
      seen.add(key);
      if (/\n/.test(m[4])) continue;
      const sentence = `${m[1]} ${m[3]} ${m[4]}.`.replace(/\s+/g, " ").trim();
      out.push({ tempId: tid("g"), qNo: "", pageNo, type: "SHORT", text: `Define ${term.charAt(0).toUpperCase() + term.slice(1)}.`, answer: sentence, source: "GENERATED" });
      out.push({ tempId: tid("g"), qNo: "", pageNo, type: "FILL_BLANK", text: sentence.replace(new RegExp(`\\b${term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`), "_____"), answer: term, source: "GENERATED" });
      out.push({ tempId: tid("g"), qNo: "", pageNo, type: "TRUE_FALSE", text: sentence, answer: "True", source: "GENERATED" });
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
