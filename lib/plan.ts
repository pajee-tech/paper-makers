import { prisma } from "./prisma";
import { HttpError } from "./auth";

export const FREE_TRIAL_LIMIT = Number(process.env.FREE_TRIAL_PAPER_LIMIT ?? 3);

export async function getPlanState(institutionId: string) {
  const inst = await prisma.institution.findUniqueOrThrow({ where: { id: institutionId } });
  let plan = inst.plan;
  // Pro expired → fall back to trial rules (already used papers stay accessible).
  if (plan === "PAPER_MAKER_PRO" && inst.proUntil && inst.proUntil < new Date()) {
    plan = "FREE_TRIAL";
    await prisma.institution.update({ where: { id: inst.id }, data: { plan: "FREE_TRIAL" } });
  }
  const isPro = plan === "PAPER_MAKER_PRO";
  const remaining = isPro ? Infinity : Math.max(0, FREE_TRIAL_LIMIT - inst.papersCreated);
  return { inst, plan, isPro, remaining, used: inst.papersCreated, limit: FREE_TRIAL_LIMIT };
}

/** Throws 402 when the free trial is exhausted. Returns whether the new paper must be watermarked. */
export async function assertCanCreatePaper(institutionId: string) {
  const s = await getPlanState(institutionId);
  if (!s.isPro && s.remaining <= 0)
    throw new HttpError(402, `Free trial finished (${s.limit} papers). Upgrade to PaperMaker Pro from Billing.`);
  return { watermark: !s.isPro };
}
