import { notFound, redirect } from "next/navigation";
import ExamPaperPreview from "@/components/ExamPaperPreview";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toPaperDTO } from "@/lib/paperDto";

export default async function PaperPage({ params }: { params: { id: string } }) {
  const s = await getSession();
  if (!s?.user.institutionId) redirect("/login");
  const p = await prisma.savedPaper.findFirst({
    where: { id: params.id, institutionId: s.user.institutionId },
    include: { institution: { select: { name: true, city: true, address: true, logoDataUrl: true } }, class: true, subject: true },
  });
  if (!p) notFound();
  return <ExamPaperPreview paper={toPaperDTO(p)} />;
}
