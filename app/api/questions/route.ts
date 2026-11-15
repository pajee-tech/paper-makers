import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { requireInstitutionUser } from "@/lib/auth";
import { ownChapter } from "@/lib/ownership";
import { QTypeZ, QuestionInput } from "@/lib/schemas";

/** GET /api/questions?chapterIds=a,b&type=MCQ&take=200 */
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const sp = new URL(req.url).searchParams;
  const chapterIds = (sp.get("chapterIds") ?? "").split(",").filter(Boolean);
  const type = sp.get("type");
  const take = Math.min(500, Number(sp.get("take") ?? 300));
  // Light list for the paper builder: no image data (papers store IDs; images load only when printing).
  // ?full=1 (question-bank screen) also returns the compressed image snippet.
  const full = sp.get("full") === "1";
  // ?types=MCQ,SHORT — strict server-side type filter
  const types = (sp.get("types") ?? "").split(",").filter(Boolean).map((t) => QTypeZ.parse(t));
  const questions = await prisma.question.findMany({
    where: {
      chapter: { subject: { class: { institutionId: u.institutionId } } },
      ...(chapterIds.length ? { chapterId: { in: chapterIds } } : {}),
      ...(type ? { type: QTypeZ.parse(type) } : types.length ? { type: { in: types } } : {}),
    },
    select: {
      id: true, type: true, text: true, urduText: true, options: true, correctOption: true, answer: true, matchPairs: true,
      icon: true, needsLines: true, lineStyle: true, lineCount: true, marks: true, difficulty: true, chapterId: true,
      imageSnippet: full,
    },
    orderBy: { createdAt: "desc" },
    take,
  });
  return json({ questions });
});

const Bulk = z.object({ chapterId: z.string(), questions: z.array(QuestionInput).min(1).max(200) });

/** POST { chapterId, questions: [...] } — used by the manual form and the PDF textbook extractor. */
export const POST = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const b = Bulk.parse(await req.json());
  await ownChapter(b.chapterId, u.institutionId);
  const data = b.questions.map((q) => ({
    ...q,
    chapterId: b.chapterId,
    options: q.options ?? Prisma.DbNull,
    matchPairs: q.matchPairs ?? Prisma.DbNull,
  }));
  const res = await prisma.question.createMany({ data });
  return json({ created: res.count }, 201);
});
