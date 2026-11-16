import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/auth";
import { bookScope, normSubject } from "@/lib/books";
import { assertFeature } from "@/lib/plan";

/** GET /api/books?className=9th&subjectName=Physics&level=MATRIC */
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const u = await requireUser();
  if (u.institutionId && u.role !== "SUPER_ADMIN") await assertFeature(u.institutionId, "library");
  const sp = new URL(req.url).searchParams;
  const className = sp.get("className");
  const subjectName = sp.get("subjectName");
  const level = sp.get("level");
  const books = await prisma.book.findMany({
    where: { ...bookScope(u), ...(level ? { level: level as never } : {}) },
    orderBy: [{ level: "asc" }, { className: "asc" }, { subjectName: "asc" }],
    select: {
      id: true, title: true, board: true, edition: true, level: true, className: true, subjectName: true, language: true, pageCount: true, status: true, institutionId: true, createdAt: true,
      _count: { select: { chapters: true, items: true } },
    },
    take: 500,
  });
  // Rank matching books first (same class + subject), then same subject.
  const ns = subjectName ? normSubject(subjectName) : null;
  const scored = books.map((b) => ({
    ...b,
    shared: b.institutionId === null,
    match: (className && b.className.toLowerCase() === className.toLowerCase() ? 2 : 0) + (ns && normSubject(b.subjectName) === ns ? 1 : 0),
  }));
  scored.sort((a, b) => b.match - a.match);
  return json({ books: scored });
});

const Create = z.object({
  title: z.string().min(2).max(200),
  board: z.string().max(80).optional(),
  edition: z.string().max(60).optional(),
  level: z.enum(["EARLY_YEARS", "PRIMARY", "MIDDLE", "MATRIC", "INTERMEDIATE", "GRADUATION"]),
  className: z.string().min(1).max(60),
  subjectName: z.string().min(1).max(100),
  language: z.enum(["en", "ur"]).default("en"),
  pageCount: z.number().int().min(1).max(3000),
  pageOffset: z.number().int().min(-50).max(500).default(0),
  shared: z.boolean().optional(), // platform library (Super Admin only)
});

export const POST = handle(async (req: Request) => {
  const u = await requireUser();
  const b = Create.parse(await req.json());
  if (b.shared && u.role !== "SUPER_ADMIN") throw new HttpError(403, "Only the platform admin can add books to the shared library");
  if (!b.shared && !u.institutionId) throw new HttpError(400, "No institution");
  if (!b.shared && u.role !== "SUPER_ADMIN") await assertFeature(u.institutionId!, "library");
  const { shared, ...data } = b;
  const book = await prisma.book.create({ data: { ...data, institutionId: shared ? null : u.institutionId } });
  return json({ id: book.id }, 201);
});
