import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { requireInstitutionUser } from "@/lib/auth";
import { ownQuestion } from "@/lib/ownership";
import { QuestionInput } from "@/lib/schemas";

type Ctx = { params: { id: string } };

export const dynamic = "force-dynamic";

export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  await ownQuestion(params.id, u.institutionId);
  const q = QuestionInput.partial().parse(await req.json());
  const updated = await prisma.question.update({
    where: { id: params.id },
    data: {
      ...q,
      options: q.options === undefined ? undefined : q.options ?? Prisma.DbNull,
      matchPairs: q.matchPairs === undefined ? undefined : q.matchPairs ?? Prisma.DbNull,
    },
  });
  return json(updated);
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  await ownQuestion(params.id, u.institutionId);
  await prisma.question.delete({ where: { id: params.id } });
  return json({ ok: true });
});
