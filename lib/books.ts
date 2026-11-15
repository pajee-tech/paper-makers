// Copyright (c) Pajee Technologies. All rights reserved.
import { prisma } from "./prisma";
import { HttpError } from "./auth";

type U = { id: string; role: string; institutionId: string | null };

/** Platform books (institutionId = null) are readable by everyone; own books only by the owner institution. */
export async function readableBook(id: string, u: U) {
  const b = await prisma.book.findUnique({ where: { id } });
  if (!b || (b.institutionId && b.institutionId !== u.institutionId && u.role !== "SUPER_ADMIN")) throw new HttpError(404, "Book not found");
  return b;
}

/** Platform books: Super Admin only. Institution books: any user of that institution. */
export async function writableBook(id: string, u: U) {
  const b = await readableBook(id, u);
  if (b.institutionId === null && u.role !== "SUPER_ADMIN") throw new HttpError(403, "Only the platform admin can edit shared library books");
  return b;
}

export const bookScope = (u: U) => (u.role === "SUPER_ADMIN" ? {} : { OR: [{ institutionId: null }, { institutionId: u.institutionId }] });

/** Loose subject matching: "Islamiat (Urdu)" ≈ "Islamiat", "Maths" ≈ "Mathematics". */
export function normSubject(s: string) {
  return s.toLowerCase().replace(/\(.*?\)/g, "").replace(/maths?\b/, "mathematics").replace(/[^a-z؀-ۿ]+/g, " ").trim();
}
