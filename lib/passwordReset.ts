// Copyright (c) Pajee Technologies. All rights reserved.
import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./prisma";

const hash = (t: string) => createHash("sha256").update(t).digest("hex");
export const RESET_TTL_MIN = 60;

/** Creates a single-use reset link (valid 60 min). Only the hash is stored. */
export async function createResetLink(userId: string, origin: string) {
  const token = randomBytes(32).toString("base64url");
  await prisma.passwordResetToken.create({
    data: { userId, tokenHash: hash(token), expiresAt: new Date(Date.now() + RESET_TTL_MIN * 60_000) },
  });
  return `${origin.replace(/\/$/, "")}/reset-password?token=${token}`;
}

export async function consumeResetToken(token: string) {
  const row = await prisma.passwordResetToken.findUnique({ where: { tokenHash: hash(token) } });
  if (!row || row.usedAt || row.expiresAt < new Date()) return null;
  await prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } });
  return row.userId;
}

export function appOrigin(req: Request) {
  return process.env.NEXTAUTH_URL ?? new URL(req.url).origin;
}
