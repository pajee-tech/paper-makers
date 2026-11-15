import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { requireInstitutionUser } from "@/lib/auth";
import { ownPaper } from "@/lib/ownership";
import { PaperInput, PrintSettingsZ } from "@/lib/schemas";
import { paperTotal } from "@/lib/templates";
import type { PaperSection } from "@/lib/types";

type Ctx = { params: { id: string } };

export const GET = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  await ownPaper(params.id, u.institutionId);
  const paper = await prisma.savedPaper.findUnique({
    where: { id: params.id },
    include: { institution: { select: { name: true, city: true, address: true, logoDataUrl: true } }, class: true, subject: true },
  });
  return json({ paper });
});

/** Full edit (sections) or just print settings: { printSettings } */
export const PUT = handle(async (req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  await ownPaper(params.id, u.institutionId);
  const body = await req.json();
  if (body && Object.keys(body).length === 1 && body.printSettings) {
    const printSettings = PrintSettingsZ.parse(body.printSettings);
    await prisma.savedPaper.update({ where: { id: params.id }, data: { printSettings } });
    return json({ ok: true });
  }
  const b = PaperInput.parse(body);
  const sections = b.sections as PaperSection[];
  // Editing an existing paper never consumes a trial credit and keeps its original watermark state.
  await prisma.savedPaper.update({
    where: { id: params.id },
    data: {
      title: b.title,
      paperType: b.paperType,
      examDate: b.examDate ? new Date(b.examDate) : null,
      timeAllowed: b.timeAllowed,
      totalMarks: paperTotal(sections),
      sections: sections as object[],
      printSettings: b.printSettings ?? undefined,
    },
  });
  return json({ ok: true });
});

export const DELETE = handle(async (_req: Request, { params }: Ctx) => {
  const u = await requireInstitutionUser();
  await ownPaper(params.id, u.institutionId);
  await prisma.savedPaper.delete({ where: { id: params.id } });
  return json({ ok: true });
});
