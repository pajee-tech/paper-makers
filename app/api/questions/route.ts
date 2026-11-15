import { z } from "zod";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { requireInstitutionUser } from "@/lib/auth";
import { ownChapter } from "@/lib/ownership";
import { QTypeZ, QuestionInput } from "@/lib/schemas";

/** GET /api/questions?chapterIds=a,b&type=MCQ&take=200 */
export const GET = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const sp = new URL(req.url).searchParams;
  const chapterIds = (sp.get("chapterIds") ?? "").split(",").filter(Boolean);
  const type = sp.get("type");
  const take = Math.min(500, Number(sp.get("take") ?? 300));
  const questions = await prisma.question.findMany({
    where: {
      chapter: { subject: { class: { institutionId: u.institutionId } } },
      ...(chapterIds.length ? { chapterId: { in: chapterIds } } : {}),
      ...(type ? { type: QTypeZ.parse(type) } : {}),
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
