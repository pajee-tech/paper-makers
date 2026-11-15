// Copyright (c) Pajee Technologies. All rights reserved.
import { prisma } from "./prisma";
import { HttpError } from "./auth";
import { getSettings } from "./settings";

export type Feature = "results" | "omrScan" | "library";

export async function getPlanState(institutionId: string) {
  const [inst, s, superCount] = await Promise.all([
    prisma.institution.findUniqueOrThrow({ where: { id: institutionId } }),
    getSettings(),
    prisma.user.count({ where: { institutionId, role: "SUPER_ADMIN" } }),
  ]);
  // The Super Admin's own institution is never on trial: unlimited papers, no expiry, no watermark.
  if (superCount > 0) {
    return {
      inst, plan: "PAPER_MAKER_PRO" as const, isPro: true, remaining: Infinity, used: inst.papersCreated, limit: s.trialPaperLimit,
      trialEndsAt: null, trialExpired: false, daysLeft: null, features: { results: true, omrScan: true, library: true } as Record<Feature, boolean>,
      teacherLimit: 100000, watermark: false, watermarkText: s.trialWatermarkText, isSuperAdmin: true,
    };
  }
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
  // An expired trial keeps read-only access (open / reprint old papers, billing) but loses every paid feature.
  const active = isPro || !trialExpired;
  const features: Record<Feature, boolean> = {
    results: active && (isPro || s.trialAllowResults),
    omrScan: active && (isPro || s.trialAllowOmrScan),
    library: active && (isPro || s.trialAllowLibrary),
  };
  const daysLeft = trialEndsAt && !isPro ? Math.max(0, Math.ceil((trialEndsAt.getTime() - Date.now()) / 86400_000)) : null;
  return {
    inst, plan, isPro, remaining, used: inst.papersCreated, limit: s.trialPaperLimit, trialEndsAt, trialExpired, daysLeft, features,
    teacherLimit: isPro ? s.proTeacherLimit : s.trialTeacherLimit,
    watermark: !isPro && s.trialWatermark,
    watermarkText: s.trialWatermarkText,
    isSuperAdmin: false,
  };
}

/** Throws 402 when the free trial is exhausted. Returns whether the new paper must be watermarked. */
export async function assertCanCreatePaper(institutionId: string) {
  const s = await getPlanState(institutionId);
  if (!s.isPro && s.trialExpired) throw new HttpError(402, `Your ${s.trialEndsAt ? Math.round((s.trialEndsAt.getTime() - s.inst.createdAt.getTime()) / 86400_000) : ""}-day free trial has ended. Upgrade to Pro to generate new papers.`);
  if (!s.isPro && s.remaining <= 0) throw new HttpError(402, `Free trial limit reached: ${s.used}/${s.limit} papers generated. Upgrade to Pro for unlimited papers.`);
  return { watermark: s.watermark };
}

export async function assertFeature(institutionId: string, f: Feature) {
  const s = await getPlanState(institutionId);
  if (!s.features[f]) {
    const name = { results: "Class results", omrScan: "OMR auto-count", library: "Textbook library" }[f];
    throw new HttpError(402, s.trialExpired ? "Your free trial has ended. Upgrade to Pro to keep using this feature." : `${name} is a Pro feature. Upgrade from Billing.`);
  }
  return s;
}
