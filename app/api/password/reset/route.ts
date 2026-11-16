import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError } from "@/lib/auth";
import { consumeResetToken } from "@/lib/passwordReset";

export const dynamic = "force-dynamic";

export const POST = handle(async (req: Request) => {
  const b = z.object({ token: z.string().min(20), password: z.string().min(8).max(100) }).parse(await req.json());
  const userId = await consumeResetToken(b.token);
  if (!userId) throw new HttpError(400, "This reset link is invalid or has expired. Ask for a new one.");
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: await bcrypt.hash(b.password, 10) } });
  return json({ ok: true });
});
