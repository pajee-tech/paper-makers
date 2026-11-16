import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { seedStandardCurriculum } from "@/lib/seed";

const Body = z.object({
  institutionName: z.string().min(2).max(120),
  institutionType: z.enum(["SCHOOL", "COLLEGE", "ACADEMY", "DEGREE_INSTITUTE"]),
  city: z.string().max(60).optional(),
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const b = Body.parse(await req.json());
  const email = b.email.toLowerCase().trim();
  if (await prisma.user.findUnique({ where: { email } })) throw new HttpError(409, "This email is already registered");

  // Public sign-up always creates a normal school account. The Super Admin is created only through the
  // developer-only page /developer (needs SUPER_ADMIN_SETUP_KEY), so nobody can claim it by registering first.
  const passwordHash = await bcrypt.hash(b.password, 10);
  const inst = await prisma.institution.create({
    data: {
      name: b.institutionName,
      type: b.institutionType,
      city: b.city,
      users: { create: { name: b.name, email, passwordHash, role: "INSTITUTION_ADMIN" } },
    },
  });
  // Every class from Playgroup to BS (Hons) with its standard subjects — editable later.
  await seedStandardCurriculum(inst.id);
  return json({ ok: true }, 201);
});
