// Copyright (c) Pajee Technologies. All rights reserved.
import { prisma } from "./prisma";
import { HttpError } from "./auth";
import { getSettings } from "./settings";

export type Feature = "results" | "omrScan" | "library";

export async function getPlanState(institutionId: string) {
  const [inst, s] = await Promise.all([prisma.institution.findUniqueOrThrow({ where: { id: institutionId } }), getSettings()]);
  let plan = inst.plan;
  // Pro expired → fall back to trial rules (already used papers stay accessible).
  if (plan === "PAPER_MAKER_PRO" && inst.proUntil && inst.proUntil < new Date()) {
    plan = "FREE_TRIAL";
    await prisma.institution.update({ where: { id: inst.id }, data: { plan: "FREE_TRIAL" } });
  }
  const isPro = plan === "PAPER_MAKER_PRO";
  const trialEndsAt = s.trialDays > 0 ? new Date(inst.createdAt.getTime() + s.trialDays * 86400_000) : null;
  const trialExpired = !isPro && !!trialEndsAt && trialEndsAt < new Date();
  const remaining = isPro ? Infinity : trialExpired ? 0 : Math.max(0, s.trialPaperLimit - inst.papersCreated);
  const features: Record<Feature, boolean> = {
    results: isPro || s.trialAllowResults,
    omrScan: isPro || s.trialAllowOmrScan,
    library: isPro || s.trialAllowLibrary,
  };
  return {
    inst, plan, isPro, remaining, used: inst.papersCreated, limit: s.trialPaperLimit, trialEndsAt, trialExpired, features,
    teacherLimit: isPro ? s.proTeacherLimit : s.trialTeacherLimit,
    watermark: !isPro && s.trialWatermark,
    watermarkText: s.trialWatermarkText,
  };
}

/** Throws 402 when the free trial is exhausted. Returns whether the new paper must be watermarked. */
export async function assertCanCreatePaper(institutionId: string) {
  const s = await getPlanState(institutionId);
  if (!s.isPro && s.trialExpired) throw new HttpError(402, "Your free trial period has ended. Upgrade to Pro from Billing.");
  if (!s.isPro && s.remaining <= 0) throw new HttpError(402, `Free trial finished (${s.limit} papers). Upgrade to Pro from Billing.`);
  return { watermark: s.watermark };
}

export async function assertFeature(institutionId: string, f: Feature) {
  const s = await getPlanState(institutionId);
  if (!s.features[f]) {
    const name = { results: "Class results", omrScan: "OMR auto-count", library: "Textbook library" }[f];
    throw new HttpError(402, `${name} is a Pro feature. Upgrade from Billing.`);
  }
  return s;
}
