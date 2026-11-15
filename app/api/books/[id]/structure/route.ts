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
  chapters: z.array(z.object({
    number: z.number().int().min(0).max(999),
    title: z.string().min(1).max(200),
    startPage: z.number().int().min(1),
    endPage: z.number().int().min(1),
    topics: z.array(z.string().max(200)).max(200).default([]),
    exercises: z.array(z.object({ title: z.string().max(200), startPage: z.number().int(), endPage: z.number().int(), items: z.array(Item).max(800) })).max(100),
  })).min(1).max(150),
});

/** Replaces the whole book outline (chapters, exercises, exercise questions). */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await writableBook(params.id, u);
  const b = Body.parse(await req.json());

  const chapters: Prisma.BookChapterCreateManyInput[] = [];
  const exercises: Prisma.BookExerciseCreateManyInput[] = [];
  const items: Prisma.BookItemCreateManyInput[] = [];
  for (const c of b.chapters) {
    const chapterId = randomUUID();
    chapters.push({ id: chapterId, bookId: book.id, number: c.number, title: c.title, startPage: c.startPage, endPage: Math.max(c.startPage, c.endPage), topics: c.topics });
    for (const e of c.exercises) {
      const exerciseId = randomUUID();
      exercises.push({ id: exerciseId, chapterId, title: e.title, startPage: e.startPage, endPage: e.endPage });
      for (const it of e.items)
        items.push({
          bookId: book.id, chapterId, exerciseId, pageNo: it.pageNo ?? null, qNo: it.qNo ?? null, topic: it.topic ?? null, source: it.source,
          type: it.type, text: it.text, options: it.options ?? Prisma.DbNull, correctOption: it.correctOption ?? null, answer: it.answer ?? null,
        });
    }
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
