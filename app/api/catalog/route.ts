import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireInstitutionUser } from "@/lib/auth";
import { ownChapter, ownClass, ownSubject } from "@/lib/ownership";
import { seedStandardCurriculum } from "@/lib/seed";

/** Classes → Subjects → Chapters tree (with question counts) for the caller's institution. */
export const dynamic = "force-dynamic";

export const GET = handle(async () => {
  const u = await requireInstitutionUser();
  // Older accounts (or ones that deleted everything) get the standard classes & subjects automatically.
  if ((await prisma.subject.count({ where: { class: { institutionId: u.institutionId } } })) === 0) await seedStandardCurriculum(u.institutionId);
  const classes = await prisma.academicClass.findMany({
    where: { institutionId: u.institutionId },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true, name: true, level: true,
      subjects: {
        orderBy: { name: "asc" },
        select: {
          id: true, name: true, isUrdu: true,
          chapters: { orderBy: { number: "asc" }, select: { id: true, number: true, title: true, isAlp: true, _count: { select: { questions: true } } } },
        },
      },
    },
  });
  return json({ classes });
});

const Create = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("seed") }),
  z.object({ kind: z.literal("class"), name: z.string().min(1).max(60), level: z.enum(["EARLY_YEARS", "PRIMARY", "MIDDLE", "MATRIC", "INTERMEDIATE", "GRADUATION"]) }),
  z.object({ kind: z.literal("subject"), classId: z.string(), name: z.string().min(1).max(80), isUrdu: z.boolean().optional() }),
  z.object({ kind: z.literal("chapter"), subjectId: z.string(), title: z.string().min(1).max(160), number: z.number().int().min(0).max(999).optional() }),
]);

export const POST = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const b = Create.parse(await req.json());
  if (b.kind === "seed") return json(await seedStandardCurriculum(u.institutionId), 201);
  if (b.kind === "class") {
    const count = await prisma.academicClass.count({ where: { institutionId: u.institutionId } });
    return json(await prisma.academicClass.create({ data: { name: b.name, level: b.level, sortOrder: count, institutionId: u.institutionId } }), 201);
  }
  if (b.kind === "subject") {
    await ownClass(b.classId, u.institutionId);
    return json(await prisma.subject.create({ data: { name: b.name, isUrdu: !!b.isUrdu, classId: b.classId } }), 201);
  }
  await ownSubject(b.subjectId, u.institutionId);
  const number = b.number ?? (await prisma.chapter.count({ where: { subjectId: b.subjectId } })) + 1;
  return json(await prisma.chapter.create({ data: { title: b.title, number, subjectId: b.subjectId } }), 201);
});

/** PATCH { kind: "chapter", id, isAlp } — mark a chapter as part of the Smart Syllabus / ALP. */
export const PATCH = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const b = z.object({ kind: z.literal("chapter"), id: z.string(), isAlp: z.boolean() }).parse(await req.json());
  await ownChapter(b.id, u.institutionId);
  return json(await prisma.chapter.update({ where: { id: b.id }, data: { isAlp: b.isAlp } }));
});

export const DELETE = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const url = new URL(req.url);
  const kind = url.searchParams.get("kind");
  const id = url.searchParams.get("id") ?? "";
  if (kind === "class") await ownClass(id, u.institutionId).then(() => prisma.academicClass.delete({ where: { id } }));
  else if (kind === "subject") await ownSubject(id, u.institutionId).then(() => prisma.subject.delete({ where: { id } }));
  else if (kind === "chapter") await ownChapter(id, u.institutionId).then(() => prisma.chapter.delete({ where: { id } }));
  else throw new HttpError(400, "Unknown kind");
  return json({ ok: true });
});
