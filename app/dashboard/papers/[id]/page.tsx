import { notFound, redirect } from "next/navigation";
import ExamPaperPreview from "@/components/ExamPaperPreview";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toPaperDTO } from "@/lib/paperDto";
import { getSettings } from "@/lib/settings";
import { expandSections } from "@/lib/paperRefs";
import { getPlanState } from "@/lib/plan";

export default async function PaperPage({ params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s?.user.institutionId) redirect("/login");
  const p = await prisma.savedPaper.findFirst({
    where: { id: params.id, institutionId: s.user.institutionId },
    include: { institution: { select: { name: true, city: true, address: true, logoDataUrl: true } }, class: true, subject: true },
  });
  if (!p) notFound();
  const sections = await expandSections(p.sections, { institutionId: s.user.institutionId, role: s.user.role });
  const dto = toPaperDTO(p, (await getSettings()).trialWatermarkText, sections);
  // Super Admin papers never carry the trial watermark (also covers papers made before this account was set as Super Admin).
  if ((await getPlanState(s.user.institutionId)).isSuperAdmin) dto.watermark = false;
  return <ExamPaperPreview paper={dto} />;
}
