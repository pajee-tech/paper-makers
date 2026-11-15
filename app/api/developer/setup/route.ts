// Copyright (c) Pajee Technologies. All rights reserved.
import { timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { seedStandardCurriculum } from "@/lib/seed";
import { developerSetupEnabled } from "@/lib/developer";

export const dynamic = "force-dynamic";

/**
 * Developer-only: creates (or upgrades) the Super Admin account.
 * Works only when BOTH env vars are set on the server:
 *   SUPER_ADMIN_EMAIL      the only email that may become Super Admin
 *   SUPER_ADMIN_SETUP_KEY  a long secret (min 16 characters) the developer types on /developer
 * Remove SUPER_ADMIN_SETUP_KEY from Vercel after setup to switch this endpoint off completely.
 */

const sameSecret = (a: string, b: string) => {
  const x = Buffer.from(a), y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};

const Body = z.object({
  setupKey: z.string().min(1).max(200),
  email: z.string().email(),
  password: z.string().min(8).max(100),
  name: z.string().min(2).max(80).optional(),
  institutionName: z.string().min(2).max(120).optional(),
});

export const POST = handle(async (req: Request) => {
  if (!developerSetupEnabled()) throw new HttpError(404, "Not found");
  const b = Body.parse(await req.json());
  await new Promise((r) => setTimeout(r, 600)); // slow down guessing
  if (!sameSecret(b.setupKey, process.env.SUPER_ADMIN_SETUP_KEY!)) throw new HttpError(403, "Wrong developer setup key");
  const email = b.email.toLowerCase().trim();
  if (email !== process.env.SUPER_ADMIN_EMAIL!.toLowerCase().trim()) throw new HttpError(403, "This email is not the configured SUPER_ADMIN_EMAIL");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    // Account already exists (e.g. registered earlier): confirm its password, then upgrade it.
    if (!(await bcrypt.compare(b.password, existing.passwordHash))) throw new HttpError(403, "Wrong password for the existing account");
    await prisma.user.update({ where: { id: existing.id }, data: { role: "SUPER_ADMIN" } });
    if (existing.institutionId) await prisma.institution.update({ where: { id: existing.institutionId }, data: { plan: "PAPER_MAKER_PRO", proUntil: null } });
    return json({ ok: true, created: false });
  }

  const inst = await prisma.institution.create({
    data: {
      name: b.institutionName ?? "Pajee Technologies (Developer)",
      type: "SCHOOL",
      plan: "PAPER_MAKER_PRO", // Super Admin: no trial, no limits, never expires
      proUntil: null,
      users: { create: { name: b.name ?? "Super Admin", email, passwordHash: await bcrypt.hash(b.password, 10), role: "SUPER_ADMIN" } },
    },
  });
  await seedStandardCurriculum(inst.id);
  return json({ ok: true, created: true }, 201);
});
