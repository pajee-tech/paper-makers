import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireInstitutionUser } from "@/lib/auth";
import { getPlanState } from "@/lib/plan";

export const GET = handle(async () => {
  const u = await requireInstitutionUser();
  const s = await getPlanState(u.institutionId);
  const payments = await prisma.paymentRequest.findMany({ where: { institutionId: u.institutionId }, orderBy: { createdAt: "desc" }, take: 20 });
  return json({
    plan: s.plan,
    proUntil: s.inst.proUntil,
    used: s.used,
    limit: s.limit,
    remaining: Number.isFinite(s.remaining) ? s.remaining : null,
    payments,
  });
});

const Body = z.object({
  method: z.enum(["JAZZCASH", "EASYPAISA", "BANK"]),
  transactionId: z.string().trim().min(4).max(60),
  amount: z.number().min(1).max(1_000_000),
  months: z.number().int().min(1).max(24),
  payerName: z.string().max(80).optional(),
  payerPhone: z.string().max(30).optional(),
});

export const POST = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const b = Body.parse(await req.json());
  const dup = await prisma.paymentRequest.findUnique({ where: { method_transactionId: { method: b.method, transactionId: b.transactionId } } });
  if (dup) throw new HttpError(409, "This Transaction ID was already submitted");
  const p = await prisma.paymentRequest.create({ data: { ...b, institutionId: u.institutionId } });
  return json(p, 201);
});
