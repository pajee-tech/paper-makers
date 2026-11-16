import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { requireUser } from "@/lib/auth";
import { readableBook, writableBook } from "@/lib/books";

export const dynamic = "force-dynamic";

export const maxDuration = 60;

type Ctx = { params: { id: string } };

/**
 * GET /api/books/:id/pages?from=10&to=14     → page texts (viewer)
 * GET /api/books/:id/pages?q=photosynthesis  → search hits with a snippet
 */
export const GET = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await readableBook(params.id, u);
  const sp = new URL(req.url).searchParams;
  const q = sp.get("q")?.trim();
  if (q) {
    const pages = await prisma.bookPage.findMany({
      where: { bookId: book.id, text: { contains: q, mode: "insensitive" } },
      orderBy: { pageNo: "asc" },
      take: 40,
      select: { pageNo: true, text: true, chapterId: true },
    });
    const hits = pages.flatMap((p) =>
      p.text.split(/\n+/).filter((l) => l.toLowerCase().includes(q.toLowerCase())).slice(0, 4).map((line) => ({ pageNo: p.pageNo, chapterId: p.chapterId, line: line.trim().slice(0, 300) })),
    );
    return json({ hits });
  }
  // ?levels=1 → OCR state of every page (Book Library: which chapters still need chapter-by-chapter OCR)
  if (sp.get("levels") === "1") {
    const all = await prisma.bookPage.findMany({ where: { bookId: book.id }, orderBy: { pageNo: "asc" }, select: { pageNo: true, ocrLevel: true, text: true } });
    return json({ levels: all.map((p) => ({ pageNo: p.pageNo, ocrLevel: p.ocrLevel, chars: p.text.replace(/\s+/g, "").length })) });
  }
  const from = Math.max(1, Number(sp.get("from") ?? 1));
  const to = Math.min(from + 30, Number(sp.get("to") ?? from));
  const pages = await prisma.bookPage.findMany({ where: { bookId: book.id, pageNo: { gte: from, lte: to } }, orderBy: { pageNo: "asc" }, select: { pageNo: true, text: true, ocr: true, ocrLevel: true } });
  return json({ pages });
});

const Batch = z.object({
  replace: z.boolean().optional(), // first batch of a re-upload clears old pages
  pages: z.array(z.object({ pageNo: z.number().int().min(1).max(3000), text: z.string().max(60_000), ocr: z.boolean().optional(), ocrLevel: z.number().int().min(0).max(2).optional() })).min(1).max(60),
});

/** Uploads page text in batches (the browser extracts it; the PDF itself is never uploaded). */
export const POST = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireUser();
  const book = await writableBook(params.id, u);
  const b = Batch.parse(await req.json());
  if (b.replace) await prisma.bookPage.deleteMany({ where: { bookId: book.id } });
  const nums = b.pages.map((p) => p.pageNo);
  await prisma.$transaction([
    prisma.bookPage.deleteMany({ where: { bookId: book.id, pageNo: { in: nums } } }),
    prisma.bookPage.createMany({ data: b.pages.map((p) => ({ bookId: book.id, pageNo: p.pageNo, text: p.text.replace(/\u0000/g, ""), ocr: !!p.ocr, ocrLevel: p.ocrLevel ?? (p.ocr ? 2 : 0) })) }),
  ]);
  return json({ saved: b.pages.length });
});
