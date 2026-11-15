import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireInstitutionUser } from "@/lib/auth";
import { getPlanState } from "@/lib/plan";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

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
    trialEndsAt: s.trialEndsAt,
    trialExpired: s.trialExpired,
    features: s.features,
    teacherLimit: s.teacherLimit,
    payments,
  });
});

const Body = z.object({
  method: z.enum(["JAZZCASH", "EASYPAISA", "BANK"]),
  transactionId: z.string().trim().min(4).max(60),
  planKey: z.string().max(30),
  payerName: z.string().max(80).optional(),
  payerPhone: z.string().max(30).optional(),
});

export const POST = handle(async (req: Request) => {
  const u = await requireInstitutionUser();
  const b = Body.parse(await req.json());
  const plan = (await getSettings()).plans.find((p) => p.key === b.planKey);
  if (!plan) throw new HttpError(400, "Unknown plan");
  const dup = await prisma.paymentRequest.findUnique({ where: { method_transactionId: { method: b.method, transactionId: b.transactionId } } });
  if (dup) throw new HttpError(409, "This Transaction ID was already submitted");
  const pending = await prisma.paymentRequest.count({ where: { institutionId: u.institutionId, status: "PENDING" } });
  if (pending >= 3) throw new HttpError(429, "You already have payments waiting for verification");
  const p = await prisma.paymentRequest.create({
    data: { method: b.method, transactionId: b.transactionId, planKey: plan.key, amount: plan.pricePkr, months: plan.months, payerName: b.payerName, payerPhone: b.payerPhone, institutionId: u.institutionId },
  });
  return json(p, 201);
});
