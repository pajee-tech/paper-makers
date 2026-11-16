// Copyright (c) Pajee Technologies. All rights reserved.
import { z } from "zod";
import { prisma } from "./prisma";

/**
 * Platform-wide settings edited by the Super Admin at /admin → Settings.
 * Stored as one JSON row (PlatformSetting "singleton"); env vars are only first-run defaults.
 */
export const PlanZ = z.object({
  key: z.string().min(1).max(30), // "monthly", "6m", "yearly"
  name: z.string().min(1).max(60),
  months: z.number().int().min(1).max(36),
  pricePkr: z.number().min(0).max(10_000_000),
  note: z.string().max(120).optional(), // "Most popular", "Save 30%"
});

export const SettingsZ = z.object({
  appName: z.string().max(60),
  companyName: z.string().max(80),
  // --- Free trial rules ---
  trialPaperLimit: z.number().int().min(0).max(1000),
  trialDays: z.number().int().min(0).max(365), // 0 = no time limit
  trialWatermark: z.boolean(),
  trialWatermarkText: z.string().max(80),
  trialAllowResults: z.boolean(), // optional result module during trial
  trialAllowOmrScan: z.boolean(),
  trialAllowLibrary: z.boolean(), // use textbook/syllabus library during trial
  trialTeacherLimit: z.number().int().min(1).max(500),
  // --- Pro ---
  plans: z.array(PlanZ).min(1).max(8),
  proTeacherLimit: z.number().int().min(1).max(5000),
  proFeatures: z.array(z.string().max(120)).max(20),
  // --- Manual payments ---
  payJazzcash: z.string().max(200),
  payEasypaisa: z.string().max(200),
  payBank: z.string().max(300),
  paymentInstructions: z.string().max(1000),
  supportWhatsapp: z.string().max(20),
  supportEmail: z.string().max(120),
});
export type PlatformSettings = z.infer<typeof SettingsZ>;

export const DEFAULT_SETTINGS: PlatformSettings = {
  appName: process.env.NEXT_PUBLIC_APP_NAME ?? "PaperMaker PK",
  companyName: "Pajee Technologies",
  trialPaperLimit: Number(process.env.FREE_TRIAL_PAPER_LIMIT ?? 20),
  trialDays: Number(process.env.FREE_TRIAL_DAYS ?? 30),
  trialWatermark: true,
  trialWatermarkText: "FREE TRIAL • PaperMaker PK by Pajee Technologies",
  trialAllowResults: true,
  trialAllowOmrScan: true,
  trialAllowLibrary: true,
  trialTeacherLimit: 2,
  plans: [
    { key: "monthly", name: "Pro Monthly", months: 1, pricePkr: Number(process.env.NEXT_PUBLIC_PRO_PRICE_PKR ?? 1500) },
    { key: "6m", name: "Pro 6 Months", months: 6, pricePkr: 7500, note: "Save 17%" },
    { key: "yearly", name: "Pro Yearly", months: 12, pricePkr: 12000, note: "Best value — save 33%" },
  ],
  proTeacherLimit: 50,
  proFeatures: [
    "Unlimited exam papers — no watermark",
    "All print sizes: A4, Legal, Letter, Folio, A5 2-up",
    "Textbook / syllabus library — pick questions by chapter & exercise",
    "OMR sheets + instant class results & WhatsApp slips",
    "Unlimited teachers (fair use)",
  ],
  payJazzcash: process.env.NEXT_PUBLIC_PAY_JAZZCASH ?? "",
  payEasypaisa: process.env.NEXT_PUBLIC_PAY_EASYPAISA ?? "",
  payBank: process.env.NEXT_PUBLIC_PAY_BANK ?? "",
  paymentInstructions: "Send the amount to any account below, then submit the Transaction ID (TID) from your SMS/receipt. Pro is activated after verification, usually within a few hours.",
  supportWhatsapp: process.env.NEXT_PUBLIC_SUPPORT_WHATSAPP ?? "",
  supportEmail: "",
};

let cache: { at: number; value: PlatformSettings } | null = null;

export async function getSettings(): Promise<PlatformSettings> {
  if (cache && Date.now() - cache.at < 30_000) return cache.value;
  let value = DEFAULT_SETTINGS;
  try {
    const row = await prisma.platformSetting.findUnique({ where: { id: "singleton" } });
    if (row) value = { ...DEFAULT_SETTINGS, ...(row.data as Partial<PlatformSettings>) };
  } catch {
    /* table missing on first deploy → defaults */
  }
  cache = { at: Date.now(), value };
  return value;
}

export async function saveSettings(s: PlatformSettings) {
  const data = SettingsZ.parse(s);
  await prisma.platformSetting.upsert({ where: { id: "singleton" }, create: { id: "singleton", data }, update: { data } });
  cache = { at: Date.now(), value: data };
  return data;
}

/** Fields safe to show to any visitor (billing page, landing page). */
export function publicSettings(s: PlatformSettings) {
  return {
    appName: s.appName,
    companyName: s.companyName,
    trialPaperLimit: s.trialPaperLimit,
    trialDays: s.trialDays,
    plans: s.plans,
    proFeatures: s.proFeatures,
    payJazzcash: s.payJazzcash,
    payEasypaisa: s.payEasypaisa,
    payBank: s.payBank,
    paymentInstructions: s.paymentInstructions,
    supportWhatsapp: s.supportWhatsapp,
    supportEmail: s.supportEmail,
  };
}
export type PublicSettings = ReturnType<typeof publicSettings>;
