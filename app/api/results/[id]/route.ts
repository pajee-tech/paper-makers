import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { requireInstitutionUser } from "@/lib/auth";
import { ownSession } from "@/lib/ownership";
import { ScoreInput } from "@/lib/schemas";
import { computeResults, DEFAULT_GRADES } from "@/lib/grading";
import type { GradeBand, ScoreRow } from "@/lib/types";

type Ctx = { params: { id: string } };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  await ownSession(params.id, u.institutionId);
  const session = await prisma.paperResultSession.findUnique({
    where: { id: params.id },
    include: {
      scores: { orderBy: { rollNo: "asc" } },
      paper: { include: { class: true, subject: true, institution: { select: { name: true, city: true, address: true, logoDataUrl: true } } } },
    },
  });
  return json({ session });
});

const Body = z.object({
  totalMarks: z.number().min(1).max(10000),
  passPercent: z.number().min(0).max(100),
  gradingScheme: z.array(z.object({ grade: z.string().max(6), min: z.number().min(0).max(100) })).max(12).optional(),
  finalize: z.boolean().optional(),
  scores: z.array(ScoreInput).max(1000),
});

/** Replaces all scores, recomputes %/grade/pass/positions on the server (single source of truth). */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  await ownSession(params.id, u.institutionId);
  const b = Body.parse(await req.json());
  const scheme: GradeBand[] = b.gradingScheme?.length ? b.gradingScheme : DEFAULT_GRADES;
  const rows = computeResults(b.scores as ScoreRow[], b.totalMarks, b.passPercent, scheme);

  await prisma.$transaction([
    prisma.studentPaperScore.deleteMany({ where: { sessionId: params.id } }),
    prisma.studentPaperScore.createMany({
      data: rows.map((r) => ({
        sessionId: params.id,
        rollNo: r.rollNo,
        studentName: r.studentName,
        fatherName: r.fatherName || null,
        parentPhone: r.parentPhone || null,
        mcqObtained: r.mcqObtained ?? null,
        subjectiveObtained: r.subjectiveObtained ?? null,
        obtained: r.obtained,
        absent: !!r.absent,
        percentage: r.percentage ?? 0,
        grade: r.grade ?? null,
        passed: !!r.passed,
        position: r.position ?? null,
        breakdown: (r.breakdown ?? undefined) as object | undefined,
        source: r.source ?? "MANUAL",
      })),
    }),
    prisma.paperResultSession.update({
      where: { id: params.id },
      data: { totalMarks: b.totalMarks, passPercent: b.passPercent, gradingScheme: scheme as unknown as object[], status: b.finalize ? "FINAL" : "DRAFT" },
    }),
  ]);
  return json({ ok: true, scores: rows });
});
