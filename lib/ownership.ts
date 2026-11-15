import { prisma } from "./prisma";
import { HttpError } from "./auth";

// Every lookup is scoped to the caller's institution so tenants never see each other's data.

export async function ownClass(classId: string, institutionId: string) {
  const c = await prisma.academicClass.findFirst({ where: { id: classId, institutionId } });
  if (!c) throw new HttpError(404, "Class not found");
  return c;
}

export async function ownSubject(subjectId: string, institutionId: string) {
  const s = await prisma.subject.findFirst({ where: { id: subjectId, class: { institutionId } }, include: { class: true } });
  if (!s) throw new HttpError(404, "Subject not found");
  return s;
}

export async function ownChapter(chapterId: string, institutionId: string) {
  const c = await prisma.chapter.findFirst({ where: { id: chapterId, subject: { class: { institutionId } } } });
  if (!c) throw new HttpError(404, "Chapter not found");
  return c;
}

export async function ownQuestion(id: string, institutionId: string) {
  const q = await prisma.question.findFirst({ where: { id, chapter: { subject: { class: { institutionId } } } } });
  if (!q) throw new HttpError(404, "Question not found");
  return q;
}

export async function ownPaper(id: string, institutionId: string) {
  const p = await prisma.savedPaper.findFirst({ where: { id, institutionId } });
  if (!p) throw new HttpError(404, "Paper not found");
  return p;
}

export async function ownSession(id: string, institutionId: string) {
  const s = await prisma.paperResultSession.findFirst({ where: { id, institutionId } });
  if (!s) throw new HttpError(404, "Result session not found");
  return s;
}
