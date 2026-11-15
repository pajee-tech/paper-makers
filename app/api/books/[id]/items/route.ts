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
  const items = await prisma.bookItem.findMany({
    where: {
      bookId: book.id,
      ...(chapterIds.length ? { chapterId: { in: chapterIds } } : {}),
      ...(exerciseId ? { exerciseId } : {}),
      ...(type ? { type: QTypeZ.parse(type) } : {}),
      ...(sources.length ? { source: { in: sources } } : {}),
      ...(q ? { text: { contains: q, mode: "insensitive" } } : {}),
    },
    orderBy: [{ chapter: { number: "asc" } }, { exerciseId: "asc" }, { createdAt: "asc" }],
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
  const res = await prisma.bookItem.createMany({
    data: b.items.map((q) => ({
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
