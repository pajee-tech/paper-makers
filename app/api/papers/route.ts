import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { requireInstitutionUser } from "@/lib/auth";
import { assertCanCreatePaper } from "@/lib/plan";
import { ownClass, ownSubject } from "@/lib/ownership";
import { PaperInput } from "@/lib/schemas";
import { paperTotal } from "@/lib/templates";
import type { PaperSection } from "@/lib/types";

export const GET = handle(async () => {
  const u = await requireInstitutionUser();
  const papers = await prisma.savedPaper.findMany({
    where: { institutionId: u.institutionId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, title: true, paperType: true, totalMarks: true, createdAt: true, watermark: true,
      class: { select: { name: true } }, subject: { select: { name: true } },
      _count: { select: { resultSessions: true } },
    },
    take: 200,
  });
  return json({ papers });
});

export const POST = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const b = PaperInput.parse(await req.json());
  if (b.classId) await ownClass(b.classId, u.institutionId);
  if (b.subjectId) await ownSubject(b.subjectId, u.institutionId);
  const { watermark } = await assertCanCreatePaper(u.institutionId);

  const sections = b.sections as PaperSection[];
  const [paper] = await prisma.$transaction([
    prisma.savedPaper.create({
      data: {
        title: b.title,
        paperType: b.paperType,
        examDate: b.examDate ? new Date(b.examDate) : null,
        timeAllowed: b.timeAllowed,
        totalMarks: paperTotal(sections),
        sections: sections as object[],
        printSettings: b.printSettings ?? undefined,
        watermark,
        classId: b.classId ?? null,
        subjectId: b.subjectId ?? null,
        institutionId: u.institutionId,
        createdById: u.id,
      },
    }),
    prisma.institution.update({ where: { id: u.institutionId }, data: { papersCreated: { increment: 1 } } }),
  ]);
  return json({ id: paper.id }, 201);
});
