import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireSuperAdmin } from "@/lib/auth";
import { appOrigin, createResetLink } from "@/lib/passwordReset";

/** GET /api/admin/users?q=ali — search any user by name/email */
export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireSuperAdmin();
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim();
  const users = await prisma.user.findMany({
    where: q ? { OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }] } : {},
    select: { id: true, name: true, email: true, role: true, createdAt: true, institution: { select: { name: true, city: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return json({ users });
});

/** POST { userId } → one-time reset link (send it to the user on WhatsApp). */
export const POST = handle(async (req: Request) => {
  await requireSuperAdmin();
  const { userId } = z.object({ userId: z.string() }).parse(await req.json());
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "User not found");
  return json({ link: await createResetLink(user.id, appOrigin(req)), email: user.email });
});
