import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireInstitutionUser } from "@/lib/auth";

export const GET = handle(async () => {
  const u = await requireInstitutionUser();
  const inst = await prisma.institution.findUnique({
    where: { id: u.institutionId },
    include: { users: { select: { id: true, name: true, email: true, role: true } } },
  });
  return json({ institution: inst });
});

const Update = z.object({
  name: z.string().min(2).max(120).optional(),
  city: z.string().max(60).nullish(),
  address: z.string().max(200).nullish(),
  phone: z.string().max(30).nullish(),
  logoDataUrl: z.string().max(200_000).refine((s) => s.startsWith("data:image/"), "image only").nullish(),
});

export const PUT = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  if (u.role === "TEACHER") throw new HttpError(403, "Only the institution admin can edit settings");
  const b = Update.parse(await req.json());
  await prisma.institution.update({ where: { id: u.institutionId }, data: b });
  return json({ ok: true });
});

const AddTeacher = z.object({ name: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(100) });

/** Institution admin adds a teacher account. */
export const POST = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  if (u.role === "TEACHER") throw new HttpError(403, "Only the institution admin can add teachers");
  const b = AddTeacher.parse(await req.json());
  const email = b.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, "Email already registered");
  await prisma.user.create({
    data: { name: b.name, email, passwordHash: await bcrypt.hash(b.password, 10), role: "TEACHER", institutionId: u.institutionId },
  });
  return json({ ok: true }, 201);
});
