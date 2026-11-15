import { notFound, redirect } from "next/navigation";
import ResultWorkspace from "@/components/ResultWorkspace";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { toPaperDTO } from "@/lib/paperDto";
import { DEFAULT_GRADES } from "@/lib/grading";

export default async function ResultPage({ params, searchParams }: { params: { id: string }; searchParams: { session?: string } }) {
  const s = await getSession();
  if (!s?.user.institutionId) redirect("/login");
  const iid = s.user.institutionId;
  const p = await prisma.savedPaper.findFirst({
    where: { id: params.id, institutionId: iid },
    include: { institution: { select: { name: true, city: true, address: true, logoDataUrl: true } }, class: true, subject: true },
  });
  if (!p) notFound();

  let session = searchParams.session ? await prisma.paperResultSession.findFirst({ where: { id: searchParams.session, paperId: p.id, institutionId: iid } }) : null;
  if (!session) session = await prisma.paperResultSession.findFirst({ where: { paperId: p.id }, orderBy: { createdAt: "desc" } });
  if (!session)
    session = await prisma.paperResultSession.create({
      data: { paperId: p.id, institutionId: iid, totalMarks: p.totalMarks, passPercent: 33, gradingScheme: DEFAULT_GRADES as unknown as object[] },
    });

  return <ResultWorkspace sessionId={session.id} paper={toPaperDTO(p)} />;
}
