import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { writableBook } from "@/lib/books";
import { QTypeZ } from "@/lib/schemas";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

type Ctx = { params: { id: string } };

const Item = z.object({
  qNo: z.string().max(30).optional(),
  pageNo: z.number().int().nullish(),
  type: QTypeZ,
  text: z.string().max(5000),
  options: z.array(z.string().max(1000)).max(6).nullish(),
  correctOption: z.number().int().min(0).max(5).nullish(),
  answer: z.string().max(3000).nullish(),
  topic: z.string().max(200).nullish(),
  source: z.enum(["EXERCISE", "GENERATED", "MANUAL"]).default("EXERCISE"),
});
const Body = z.object({
  // Re-read of an existing book: keep teacher-added / auto-generated questions and reuse question IDs
  // of unchanged questions so papers that already use them keep working.
  keepExisting: z.boolean().optional(),
  chapters: z.array(z.object({
    isAlp: z.boolean().optional(),
    number: z.number().int().min(0).max(999),
    title: z.string().min(1).max(200),
    startPage: z.number().int().min(1),
    endPage: z.number().int().min(1),
    topics: z.array(z.string().max(200)).max(200).default([]),
    exercises: z.array(z.object({ title: z.string().max(200), startPage: z.number().int(), endPage: z.number().int(), items: z.array(Item).max(800) })).max(300),
  })).min(1).max(150),
});

// PostgreSQL text cannot hold NUL characters (some PDF fonts produce them) — one would fail the whole save.
const noNul = (s: string) => s.replace(/\u0000/g, "");
const noNulOrNull = (s: string | null | undefined) => (s == null ? null : noNul(s));

/** Replaces the whole book outline (chapters, exercises, exercise questions). */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await writableBook(params.id, u);
  const b = Body.parse(await req.json());

  // Old items: reuse their IDs for the same question (same chapter no. + same opening words).
  const norm = (t: string) => t.toLowerCase().replace(/[^a-z0-9\u0600-\u06ff]+/g, " ").trim().slice(0, 50);
  const old = b.keepExisting
    ? await prisma.bookItem.findMany({ where: { bookId: book.id }, select: { id: true, text: true, source: true, type: true, urduText: true, options: true, correctOption: true, answer: true, matchPairs: true, imageSnippet: true, marks: true, pageNo: true, qNo: true, topic: true, chapter: { select: { number: true } } } })
    : [];
  // second key without any spaces/symbols: a question still matches after the improved reader fixed
  // split words ("De fi ne" → "Define"), a removed watermark or a page number
  const compact = (t: string) => t.toLowerCase().replace(/pctb|not\s*for\s*sale|free\s*distribution/g, "").replace(/[^a-z0-9\u0600-\u06ff]+/g, "").slice(0, 40);
  const reuse = new Map<string, string>();
  const reuseCompact = new Map<string, string>();
  const oldAnswer = new Map<string, number | null>();
  for (const o of old) if (o.source === "EXERCISE") {
    reuse.set(`${o.chapter.number}|${norm(o.text)}`, o.id);
    if (!reuseCompact.has(`${o.chapter.number}|${compact(o.text)}`)) reuseCompact.set(`${o.chapter.number}|${compact(o.text)}`, o.id);
    oldAnswer.set(o.id, o.correctOption);
  }
  const oldAlp = b.keepExisting ? new Map((await prisma.bookChapter.findMany({ where: { bookId: book.id }, select: { number: true, isAlp: true } })).map((c) => [c.number, c.isAlp])) : new Map<number, boolean>();
  const taken = new Set<string>();

  const chapters: Prisma.BookChapterCreateManyInput[] = [];
  const exercises: Prisma.BookExerciseCreateManyInput[] = [];
  const items: Prisma.BookItemCreateManyInput[] = [];
  const t0 = Date.now();
  for (const c of b.chapters) {
    const chapterId = randomUUID();
    chapters.push({ id: chapterId, bookId: book.id, number: c.number, title: noNul(c.title) || `Chapter ${c.number}`, startPage: c.startPage, endPage: Math.max(c.startPage, c.endPage), topics: c.topics.map(noNul), isAlp: c.isAlp ?? oldAlp.get(c.number) ?? false });
    for (const e of c.exercises) {
      const exerciseId = randomUUID();
      exercises.push({ id: exerciseId, chapterId, title: noNul(e.title), startPage: e.startPage, endPage: e.endPage });
      for (const it of e.items) {
        const key = `${c.number}|${norm(it.text)}`;
        const exact = reuse.get(key);
        const keepId = exact && !taken.has(exact) ? exact : reuseCompact.get(`${c.number}|${compact(it.text)}`);
        const id = keepId && !taken.has(keepId) ? keepId : randomUUID();
        taken.add(id);
        items.push({
          // one millisecond apart → the book's printed order is kept when items are listed (createMany gives them one time)
          createdAt: new Date(t0 + items.length),
          id, bookId: book.id, chapterId, exerciseId, pageNo: it.pageNo ?? null, qNo: noNulOrNull(it.qNo), topic: noNulOrNull(it.topic), source: it.source,
          type: it.type, text: noNul(it.text), options: it.options ? it.options.map(noNul) : Prisma.DbNull,
          // a re-read keeps an answer the teacher already entered when the book itself has no key for it
          correctOption: it.correctOption ?? (keepId && id === keepId ? oldAnswer.get(keepId) ?? null : null), answer: noNulOrNull(it.answer),
        });
      }
    }
  }

  // Teacher-added and auto-generated questions survive a re-read (matched to the same chapter number).
  const byNumber = new Map(chapters.map((c) => [c.number, c.id as string]));
  for (const o of old) {
    if (o.source === "EXERCISE") continue;
    const chapterId = byNumber.get(o.chapter.number) ?? (chapters[0]?.id as string);
    if (!chapterId) continue;
    items.push({
      id: o.id, bookId: book.id, chapterId, exerciseId: null, pageNo: o.pageNo, qNo: o.qNo, topic: o.topic, source: o.source, type: o.type, text: o.text,
      urduText: o.urduText, options: (o.options as Prisma.InputJsonValue) ?? Prisma.DbNull, correctOption: o.correctOption, answer: o.answer,
      matchPairs: (o.matchPairs as Prisma.InputJsonValue) ?? Prisma.DbNull, imageSnippet: o.imageSnippet, marks: o.marks,
    });
  }

  await prisma.$transaction(
    [
      prisma.bookChapter.deleteMany({ where: { bookId: book.id } }), // cascades exercises + items
      prisma.bookChapter.createMany({ data: chapters }),
      prisma.bookExercise.createMany({ data: exercises }),
      prisma.bookItem.createMany({ data: items }),
      ...b.chapters.map((c, i) =>
        prisma.bookPage.updateMany({ where: { bookId: book.id, pageNo: { gte: c.startPage, lte: Math.max(c.startPage, c.endPage) } }, data: { chapterId: chapters[i].id } }),
      ),
      prisma.book.update({ where: { id: book.id }, data: { status: "READY" } }),
    ],
  );
  return json({ chapters: chapters.length, exercises: exercises.length, items: items.length });
});
