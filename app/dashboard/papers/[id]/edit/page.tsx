import { notFound, redirect } from "next/navigation";
import PaperBuilder, { type BuildOptions } from "@/components/PaperBuilder";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import type { PrintSettings } from "@/lib/types";
import { expandSections } from "@/lib/paperRefs";

export default async function EditPaperPage({ params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s?.user.institutionId) redirect("/login");
  const p = await prisma.savedPaper.findFirst({ where: { id: params.id, institutionId: s.user.institutionId } });
  if (!p) notFound();
  return (
    <div>
      <h1>Edit Paper</h1>
      <PaperBuilder
        initial={{
          id: p.id,
          title: p.title,
          paperType: p.paperType,
          examDate: p.examDate?.toISOString() ?? null,
          timeAllowed: p.timeAllowed,
          classId: p.classId,
          subjectId: p.subjectId,
          sections: await expandSections(p.sections, { institutionId: s.user.institutionId, role: s.user.role }),
          printSettings: p.printSettings as unknown as PrintSettings | null,
          buildOptions: (p.buildOptions as BuildOptions | null) ?? null,
        }}
      />
    </div>
  );
}
