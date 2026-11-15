import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { handle, json } from "@/lib/api";
import { HttpError, requireSuperAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const GET = handle(async (req: Request) => {
  await requireSuperAdmin();
  const status = new URL(req.url).searchParams.get("status");
  const payments = await prisma.paymentRequest.findMany({
    where: status ? { status: status as "PENDING" | "APPROVED" | "REJECTED" } : {},
    orderBy: { createdAt: "desc" },
    include: { institution: { select: { id: true, name: true, city: true, plan: true, proUntil: true, papersCreated: true } } },
    take: 300,
  });
  const institutions = await prisma.institution.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, city: true, type: true, plan: true, proUntil: true, papersCreated: true, createdAt: true, _count: { select: { users: true } } },
    take: 500,
  });
  return json({ payments, institutions });
});

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve"), paymentId: z.string(), months: z.number().int().min(1).max(36).optional() }),
  z.object({ action: z.literal("reject"), paymentId: z.string(), note: z.string().max(300).optional() }),
  // Direct Pro toggle on an institution (e.g. cash payment received in person)
  z.object({ action: z.literal("setPlan"), institutionId: z.string(), plan: z.enum(["FREE_TRIAL", "PAPER_MAKER_PRO"]), months: z.number().int().min(1).max(36).optional() }),
]);

const addMonths = (from: Date, m: number) => {
  const d = new Date(from);
  d.setMonth(d.getMonth() + m);
  return d;
};

export const PATCH = handle(async (req: Request) => {
  await requireSuperAdmin();
  const b = Body.parse(await req.json());

  if (b.action === "setPlan") {
    const inst = await prisma.institution.findUnique({ where: { id: b.institutionId } });
    if (!inst) throw new HttpError(404, "Institution not found");
    const base = inst.proUntil && inst.proUntil > new Date() ? inst.proUntil : new Date();
    await prisma.institution.update({
      where: { id: inst.id },
      data: b.plan === "PAPER_MAKER_PRO" ? { plan: b.plan, proUntil: addMonths(base, b.months ?? 1) } : { plan: b.plan, proUntil: null },
    });
    return json({ ok: true });
  }

  const p = await prisma.paymentRequest.findUnique({ where: { id: b.paymentId }, include: { institution: true } });
  if (!p) throw new HttpError(404, "Payment not found");
  if (p.status !== "PENDING") throw new HttpError(409, "Already reviewed");

  if (b.action === "reject") {
    await prisma.paymentRequest.update({ where: { id: p.id }, data: { status: "REJECTED", note: b.note, reviewedAt: new Date() } });
    return json({ ok: true });
  }

  const months = b.months ?? p.months;
  const base = p.institution.proUntil && p.institution.proUntil > new Date() ? p.institution.proUntil : new Date();
  await prisma.$transaction([
    prisma.paymentRequest.update({ where: { id: p.id }, data: { status: "APPROVED", reviewedAt: new Date() } }),
    prisma.institution.update({ where: { id: p.institutionId }, data: { plan: "PAPER_MAKER_PRO", proUntil: addMonths(base, months) } }),
  ]);
  return json({ ok: true });
});
