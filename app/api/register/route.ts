import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import type { Level } from "@/lib/types";

const Body = z.object({
  institutionName: z.string().min(2).max(120),
  institutionType: z.enum(["SCHOOL", "COLLEGE", "ACADEMY", "DEGREE_INSTITUTE"]),
  city: z.string().max(60).optional(),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const ALL: [string, Level][] = [
  ["Nursery", "EARLY_YEARS"], ["KG", "EARLY_YEARS"], ["Prep", "EARLY_YEARS"],
  ["Class 1", "PRIMARY"], ["Class 2", "PRIMARY"], ["Class 3", "PRIMARY"], ["Class 4", "PRIMARY"], ["Class 5", "PRIMARY"],
  ["Class 6", "MIDDLE"], ["Class 7", "MIDDLE"], ["Class 8", "MIDDLE"],
  ["9th", "MATRIC"], ["10th", "MATRIC"],
  ["1st Year (11th)", "INTERMEDIATE"], ["2nd Year (12th)", "INTERMEDIATE"],
  ["BA / BSc", "GRADUATION"], ["ADP", "GRADUATION"], ["BS", "GRADUATION"],
];
const LEVELS_BY_TYPE: Record<string, Level[]> = {
  SCHOOL: ["EARLY_YEARS", "PRIMARY", "MIDDLE", "MATRIC"],
  COLLEGE: ["MATRIC", "INTERMEDIATE", "GRADUATION"],
  ACADEMY: ["PRIMARY", "MIDDLE", "MATRIC", "INTERMEDIATE"],
  DEGREE_INSTITUTE: ["INTERMEDIATE", "GRADUATION"],
};

export const POST = handle(async (req: Request) => {
  const b = Body.parse(await req.json());
  const email = b.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, "This email is already registered");

  const isSuper = !!process.env.SUPER_ADMIN_EMAIL && email === process.env.SUPER_ADMIN_EMAIL.toLowerCase();
  const levels = LEVELS_BY_TYPE[b.institutionType];
  const classes = ALL.filter(([, l]) => levels.includes(l)).map(([name, level], i) => ({ name, level, sortOrder: i }));

  const passwordHash = await bcrypt.hash(b.password, 10);
  await prisma.institution.create({
    data: {
      name: b.institutionName,
      type: b.institutionType,
      city: b.city,
      classes: { create: classes },
      users: { create: { name: b.name, email, passwordHash, role: isSuper ? "SUPER_ADMIN" : "INSTITUTION_ADMIN" } },
    },
  });
  return json({ ok: true }, 201);
});
