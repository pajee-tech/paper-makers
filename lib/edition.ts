// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * Which edition this build is.
 *  - "full": everything on.
 *  - "test": launch/testing edition — books can be uploaded and their exercise questions ticked into a paper by hand,
 *            but there is no automatic picking from the e-book and no Smart Syllabus (ALP) switches.
 * Change EDITION below (or set NEXT_PUBLIC_EDITION on Vercel) and redeploy.
 */
export const EDITION: "full" | "test" = (process.env.NEXT_PUBLIC_EDITION === "test" || process.env.NEXT_PUBLIC_EDITION === "full" ? process.env.NEXT_PUBLIC_EDITION : "full") as "full" | "test";

export const APP_VERSION = "1.8";

export const FEATURES = {
  /** 🎲 Auto-pick may take questions from uploaded books */
  bookAutoPick: EDITION === "full",
  /** Smart Syllabus / ALP switches (builder, Question Bank, Book Library) */
  smartSyllabus: EDITION === "full",
};
