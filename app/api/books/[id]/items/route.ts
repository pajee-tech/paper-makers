import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { readableBook, writableBook } from "@/lib/books";
import { QTypeZ, QuestionInput } from "@/lib/schemas";

type Ctx = { params: { id: string } };

/**
 * GET /api/books/:id/items?chapterIds=a,b&exerciseId=x&type=MCQ&source=EXERCISE,GENERATED&q=word
 */
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await readableBook(params.id, u);
  const sp = new URL(req.url).searchParams;
  const chapterIds = (sp.get("chapterIds") ?? "").split(",").filter(Boolean);
  const exerciseId = sp.get("exerciseId");
  const type = sp.get("type");
  const sources = (sp.get("source") ?? "").split(",").filter(Boolean);
  const q = sp.get("q")?.trim();
  const full = sp.get("full") === "1";
  const items = await prisma.bookItem.findMany({
    where: {
      bookId: book.id,
      ...(chapterIds.length ? { chapterId: { in: chapterIds } } : {}),
      ...(exerciseId ? { exerciseId } : {}),
      ...(type ? { type: QTypeZ.parse(type) } : {}),
      ...(sources.length ? { source: { in: sources } } : {}),
      ...(q ? { text: { contains: q, mode: "insensitive" } } : {}),
    },
    select: {
      id: true, chapterId: true, exerciseId: true, pageNo: true, qNo: true, topic: true, source: true, type: true, text: true,
      urduText: true, options: true, correctOption: true, answer: true, matchPairs: true, marks: true, imageSnippet: full,
    },
    orderBy: [{ chapter: { number: "asc" } }, { createdAt: "asc" }], // printed order (createdAt is kept 1 ms apart on save)
    take: 2000,
  });
  return json({ items });
});

const Add = z.object({
  chapterId: z.string(),
  exerciseId: z.string().nullish(),
  source: z.enum(["GENERATED", "MANUAL"]).default("MANUAL"),
  items: z.array(QuestionInput.extend({ pageNo: z.number().int().nullish(), qNo: z.string().max(30).nullish(), topic: z.string().max(200).nullish() })).min(1).max(300),
});

/** Add manual / auto-generated questions to a chapter (optionally inside an exercise). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await writableBook(params.id, u);
  const b = Add.parse(await req.json());
  const ch = await prisma.bookChapter.findFirst({ where: { id: b.chapterId, bookId: book.id } });
  if (!ch) throw new HttpError(404, "Chapter not found");
  const t0 = Date.now();
  const res = await prisma.bookItem.createMany({
    data: b.items.map((q, i) => ({
      createdAt: new Date(t0 + i), // keeps the order they were added in
      bookId: book.id, chapterId: ch.id, exerciseId: b.exerciseId ?? null, source: b.source,
      pageNo: q.pageNo ?? null, qNo: q.qNo ?? null, topic: q.topic ?? null,
      type: q.type, text: q.text, urduText: q.urduText ?? null, options: q.options ?? Prisma.DbNull, correctOption: q.correctOption ?? null,
      answer: q.answer ?? null, matchPairs: q.matchPairs ?? Prisma.DbNull, imageSnippet: q.imageSnippet ?? null, marks: q.marks ?? 1,
    })),
  });
  return json({ created: res.count }, 201);
});

const Edit = QuestionInput.partial().extend({ itemId: z.string() });

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await writableBook(params.id, u);
  const { itemId, ...q } = Edit.parse(await req.json());
  const r = await prisma.bookItem.updateMany({
    where: { id: itemId, bookId: book.id },
    data: {
      ...q,
      options: q.options === undefined ? undefined : q.options ?? Prisma.DbNull,
      matchPairs: q.matchPairs === undefined ? undefined : q.matchPairs ?? Prisma.DbNull,
    },
  });
  if (!r.count) throw new HttpError(404, "Question not found");
  return json({ ok: true });
});

/** DELETE ?itemId=… or ?chapterId=…&source=GENERATED (clear generated questions of a chapter) */
export const DELETE = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await writableBook(params.id, u);
  const sp = new URL(req.url).searchParams;
  const itemId = sp.get("itemId");
  const chapterId = sp.get("chapterId");
  if (itemId) await prisma.bookItem.deleteMany({ where: { id: itemId, bookId: book.id } });
  else if (chapterId && sp.get("source") === "GENERATED") await prisma.bookItem.deleteMany({ where: { bookId: book.id, chapterId, source: "GENERATED" } });
  else throw new HttpError(400, "Nothing to delete");
  return json({ ok: true });
});

const Answers = z.object({ answers: z.array(z.object({ itemId: z.string(), correctOption: z.number().int().min(0).max(5).nullable() })).min(1).max(500) });

/** PUT { answers: [{ itemId, correctOption }] } — save an exercise's MCQ answer key in one go. */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await writableBook(params.id, u);
  const b = Answers.parse(await req.json());
  await prisma.$transaction(
    b.answers.map((a) => prisma.bookItem.updateMany({ where: { id: a.itemId, bookId: book.id, type: "MCQ" }, data: { correctOption: a.correctOption } })),
  );
  return json({ saved: b.answers.length });
});
