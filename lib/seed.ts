// Copyright (c) Pajee Technologies. All rights reserved.
import { prisma } from "./prisma";
import { STANDARD_CLASSES } from "./curriculum";

/**
 * Adds every standard class and its standard subjects to an institution.
 * Idempotent: existing classes/subjects (matched by name) are kept, only missing ones are added.
 */
export async function seedStandardCurriculum(institutionId: string) {
  const existing = await prisma.academicClass.findMany({ where: { institutionId }, include: { subjects: { select: { name: true } } } });
  const byName = new Map(existing.map((c) => [c.name.toLowerCase(), c]));
  let addedClasses = 0, addedSubjects = 0;

  for (const [i, std] of STANDARD_CLASSES.entries()) {
    let cls = byName.get(std.name.toLowerCase());
    if (!cls) {
      const created = await prisma.academicClass.create({ data: { name: std.name, level: std.level, sortOrder: i, institutionId } });
      cls = { ...created, subjects: [] };
      addedClasses++;
    }
    const have = new Set(cls.subjects.map((s) => s.name.toLowerCase()));
    const missing = std.subjects.filter((s) => !have.has(s.name.toLowerCase()));
    if (missing.length) {
      await prisma.subject.createMany({ data: missing.map((s) => ({ name: s.name, isUrdu: !!s.urdu, classId: cls!.id })), skipDuplicates: true });
      addedSubjects += missing.length;
    }
  }
  return { addedClasses, addedSubjects };
}
