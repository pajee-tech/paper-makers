import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { readableBook, writableBook } from "@/lib/books";

type Ctx = { params: { id: string } };

/** Book outline: chapters → topics + exercises (with question counts). */
export const dynamic = "force-dynamic";

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await readableBook(params.id, u);
  const chapters = await prisma.bookChapter.findMany({
    where: { bookId: book.id },
    orderBy: { number: "asc" },
    include: {
      exercises: { orderBy: { startPage: "asc" }, include: { _count: { select: { items: true } } } },
      _count: { select: { items: true } },
    },
  });
  const generated = await prisma.bookItem.groupBy({ by: ["chapterId"], where: { bookId: book.id, source: "GENERATED" }, _count: true });
  const genMap = Object.fromEntries(generated.map((g) => [g.chapterId, g._count]));
  return json({
    book: { ...book, shared: book.institutionId === null, canEdit: book.institutionId !== null || u.role === "SUPER_ADMIN" },
    chapters: chapters.map((c) => ({ ...c, generatedCount: genMap[c.id] ?? 0 })),
  });
});

const Patch = z.object({
  title: z.string().min(2).max(200).optional(),
  board: z.string().max(80).nullish(),
  edition: z.string().max(60).nullish(),
  className: z.string().min(1).max(60).optional(),
  subjectName: z.string().min(1).max(100).optional(),
  pageOffset: z.number().int().min(-50).max(500).optional(),
  chapter: z.object({ id: z.string(), title: z.string().min(1).max(160).optional(), number: z.number().int().min(0).max(999).optional() }).optional(),
});

export const PATCH = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await writableBook(params.id, u);
  const { chapter, ...meta } = Patch.parse(await req.json());
  if (chapter) await prisma.bookChapter.updateMany({ where: { id: chapter.id, bookId: book.id }, data: { title: chapter.title, number: chapter.number } });
  if (Object.keys(meta).length) await prisma.book.update({ where: { id: book.id }, data: meta });
  return json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await writableBook(params.id, u);
  await prisma.book.delete({ where: { id: book.id } });
  return json({ ok: true });
});
