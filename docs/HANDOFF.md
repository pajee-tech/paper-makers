# PaperMaker PK — Project Handoff & Full Conversation History

> **Purpose:** paste this file (plus the code zip) into any AI model or give it to a developer to continue the project exactly where it stopped.
> **State as of:** 15 Nov 2026 · latest version **v1.6** · owner: **Shahzaib Hussain** · company: **Pajee Technologies**
> **Live site (user's deployment):** `https://paper-makers-jade.vercel.app`

---

## 0. How to continue (read first)

1. The code is in `paper-maker-pk.zip` → folder `paper-maker/`. The README in the code has per-version technical notes. This file covers the *why*.
2. The user writes in **Roman Urdu**. Reply in simple Roman Urdu; keep technical names in English.
3. **The user's standing rule:** change ONLY what they ask for. Don't refactor or "improve" other parts without asking. When something must change to fix the request, say so clearly.
4. The user is not a developer. Deliver: an updated zip + short plain steps (upload to GitHub → Vercel redeploys). Never ask them to run terminal commands unless unavoidable.
5. Before shipping, always run `npx tsc --noEmit` and `next build`, and test real flows (see §9 for the local DB recipe).
6. Hard constraint from the start: **100% free stack** — no paid APIs (no OpenAI/Claude API, no Puppeteer, no paid OCR/PDF, no Clerk, no S3). PDF reading, OCR, OMR and PDF export run in the browser.

---

## 1. What the product is

A SaaS for Pakistani schools, colleges, academies and degree institutes (Playgroup → BS Hons):
- **Exam paper generator** — question bank + shared textbook library → board-pattern papers (BISE Punjab, FBISE, primary/montessori patterns), printed in A4 / Legal / Letter / Folio / A5 2-up, with answer key and OMR bubble sheet.
- **Optional class result maker** — marks by typing, Excel/CSV, or scanned OMR sheets (browser OMR + tesseract.js) → %, grade, pass/fail, positions, award list, 4-per-page slips, WhatsApp links to parents.
- **Monetisation** — free trial (30 days / 20 papers, watermark) → Pro plans paid manually by JazzCash / EasyPaisa / bank with a Transaction ID (TID); Super Admin approves.
- Copyright/branding: **© Pajee Technologies**, proprietary (`LICENSE`), footer on every page, `/terms`.

## 2. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14.2 App Router, React 18, TypeScript |
| Auth | NextAuth 4 (credentials, JWT), bcryptjs |
| DB | Prisma 5.22 + Neon PostgreSQL free tier (pooled URL, `connection_limit=1`) |
| Hosting | Vercel Hobby (GitHub-connected; build = `prisma generate && prisma db push --skip-generate && next build`) |
| Browser libs | pdfjs-dist 4.10 (worker copied to `/public` by `scripts/copy-pdf-worker.mjs`), tesseract.js 5, KaTeX, xlsx (SheetJS CDN tarball 0.20.3) |
| Email (optional) | nodemailer via any SMTP (Gmail App Password) |
| Fonts | Noto Nastaliq Urdu (Google Fonts link) |

## 3. Code map (most important files)

| Area | Files |
|---|---|
| Schema | `prisma/schema.prisma` |
| Auth & roles | `lib/auth.ts`, `middleware.ts`, `app/api/register`, `app/developer` + `app/api/developer/setup` (Super Admin creation), `lib/developer.ts` |
| Password reset | `lib/passwordReset.ts`, `lib/mail.ts`, `app/forgot-password`, `app/reset-password`, `app/api/password/*`, `components/PasswordInput.tsx` |
| Plans & trial | `lib/settings.ts` (PlatformSetting JSON, live-editable), `lib/plan.ts` (`getPlanState`, `assertCanCreatePaper`, `assertFeature`), `components/UpgradePrompt.tsx` |
| Curriculum | `lib/curriculum.ts` (Playgroup→BS + subjects), `lib/seed.ts` |
| Question bank | `components/QuestionBank.tsx`, `components/QuestionForm.tsx`, `app/api/questions`, `app/api/catalog` |
| Textbook library | `components/BookUploader.tsx`, `components/BookViewer.tsx`, `lib/bookParse.ts` (chapters/topics/exercises/questions, footer cleaning, answer keys, generator), `lib/pdfText.ts`, `app/api/books/*` |
| Paper builder | `components/PaperBuilder.tsx`, `lib/templates.ts` (26 templates), `lib/subjectTemplates.ts` (BISE Punjab presets), `lib/scope.ts`, `lib/questionRules.ts` (strict types) |
| Paper storage | `lib/paperRefs.ts` (compact to IDs + light text copy / expand), `app/api/papers/*`, `lib/paperDto.ts` |
| Print engine | `components/ExamPaperPreview.tsx`, `lib/paperSizes.ts`, `app/globals.css`, `components/MathText.tsx`, `TracingLines.tsx`, `SvgIcons.tsx`, `OmrSheet.tsx` |
| OMR & results | `lib/omrLayout.ts` (shared geometry), `lib/omrScan.ts`, `components/CheckedPdfResultCounter.tsx`, `ResultWorkspace.tsx`, `ResultPrintouts.tsx`, `lib/grading.ts`, `app/api/results/[id]` |
| Client cache | `lib/clientCache.ts` (IndexedDB, 24h), `components/useCatalog.ts` (`api()` auto-invalidates on writes) |
| Admin | `app/admin/page.tsx` (Payments, Institutions, Users & passwords, Trial & Pro settings), `app/api/admin/*` |
| Billing | `app/dashboard/billing/page.tsx`, `app/api/billing` |
| Public | `app/page.tsx`, `app/demo` (no-login sample paper), `app/terms`, `components/PublicHeader.tsx`, `components/Footer.tsx` |

## 4. Data model (Prisma, summary)

- `Institution` (plan FREE_TRIAL | PAPER_MAKER_PRO, proUntil, papersCreated counter, logo) → `User` (role SUPER_ADMIN | INSTITUTION_ADMIN | TEACHER).
- `AcademicClass` (level EARLY_YEARS…GRADUATION) → `Subject` (isUrdu) → `Chapter` (isAlp) → `Question` (type enum of 14 types, options, correctOption, answer, matchPairs, imageSnippet WebP data URL, needsLines…).
- `SavedPaper`: `sections` JSON (**question references**, see §6), `printSettings`, `buildOptions` (scope/book/chapters restore on Edit), `watermark`.
- `PaperResultSession` → `StudentPaperScore`.
- `PaymentRequest` (method, transactionId unique per method, planKey, amount, months, status).
- `PlatformSetting` (singleton JSON: trial rules, plans, payment accounts, support numbers).
- `PasswordResetToken` (sha256 hash, 60 min, single use).
- Library: `Book` (institutionId null = shared) → `BookPage` (text per page) / `BookChapter` (isAlp, topics) → `BookExercise` → `BookItem` (source EXERCISE | GENERATED | MANUAL, qNo, pageNo, type, options, correctOption…).

## 5. Key rules & mechanisms (don't break these)

- **Strict question types** (`lib/questionRules.ts`): MCQ section → only MCQ with ≥2 options; SHORT → only SHORT (options stripped); LONG → only LONG. Enforced in the builder pools, on save (`sanitizeSections`) and when printing.
- **Paper storage** (`lib/paperRefs.ts`): bank question → `{id, ref:"q", type, marks, c}`, book item → `{id (without "book-"), ref:"b", …, c}`, custom/edited → full content (`id` starts `custom-`). `c` = light text copy (no image) used as a fallback. Expand uses the **same book access rule as the builder** (Super Admin = any book; others = shared + own).
- **IDs in the builder:** bank = raw cuid, book = `book-<id>`, custom = `custom-<random>`. Editing a question in a paper (✏️) turns it into a custom copy; the bank and book stay unchanged.
- **Trial:** `papersCreated` increments when a paper is created (not on reprint or edit). Expired trial → paper creation, results, OMR and library uploads are blocked (402), but old papers stay viewable. The **Super Admin's own institution is always unlimited** (checked by role in `getPlanState`).
- **Super Admin** is created only via `/developer` with `SUPER_ADMIN_EMAIL` + `SUPER_ADMIN_SETUP_KEY` (≥16 chars). `/register` never creates one.
- **OMR geometry** lives only in `lib/omrLayout.ts` (shared by print and scan). The OMR page prints portrait through a named `@page omr`.
- **Book reader** (`lib/bookParse.ts`): `cleanPages()` removes bare page numbers and lines repeated on ≥25% of pages (≥4 pages); `splitInline` accepts 2 options on an option line; answer-key blocks (`Answers`, `Answer Key`, `جوابات`) set `correctOption`. **No guessing of answers without a key** (the user agreed: the app must not invent answers).
- **Re-read** (`PUT /api/books/:id/structure` with `keepExisting`) reuses item IDs (same chapter no. + same opening words), keeps ALP flags, teacher-typed answers, and MANUAL/GENERATED items.
- **Client cache:** IndexedDB, 24 h, groups `q:` `cat:` `book:`; every non-GET through `api()` invalidates the affected groups; cleared on sign-out or when another user signs in.
- **Print:** dynamic `@page` CSS injected; default margin 12 mm; header = centred identity + full-width left-aligned metadata table; MCQ options in a strict 4-column row or 2×2 grid.

## 6. Environment variables

`DATABASE_URL` (Neon pooled + `&pgbouncer=true&connect_timeout=15&connection_limit=1&pool_timeout=20`), `DIRECT_URL`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `SUPER_ADMIN_EMAIL`, `SUPER_ADMIN_SETUP_KEY` (setup only), optional `NEXT_PUBLIC_APP_NAME`, `FREE_TRIAL_PAPER_LIMIT` (20), `FREE_TRIAL_DAYS` (30), `SMTP_HOST/PORT/USER/PASS/FROM`, legacy defaults `NEXT_PUBLIC_PAY_*` / `NEXT_PUBLIC_PRO_PRICE_PKR` / `NEXT_PUBLIC_SUPPORT_WHATSAPP` (first-run only; live values in `/admin` settings).

---

## 7. Conversation history (chronological, latest decisions win)

### Request 1 — Build the whole app (v1.0)
User spec: commercial free-stack "Automated Exam Paper Generator & Optional Instant Result Maker" for Pakistan, Nursery→Graduation, launch in one week; Vercel + Neon; client-side pdfjs + tesseract; `@media print`; Prisma models Institution/User/AcademicClass/Subject/Chapter/Question/SavedPaper/PaperResultSession/StudentPaperScore; `PdfBookPaperExtractor.tsx`; 5 print sizes; optional results (manual/Excel/PDF OMR); 3 free papers, watermark, manual JazzCash/EasyPaisa payments + Super Admin approval.
Done: the full Next.js app. The user's own schema and extractor couldn't be reached (their computer wasn't connected), so both were written to the spec's names. OMR reader tested on synthetic and real printed sheets.

### Request 2 — "Generate code so I can run it on Vercel"
Done: build script runs `prisma db push`; step-by-step GitHub → Vercel → Neon guide. GitHub isn't connected to Claude, so the user uploads files manually.

### Request 3 — Launch feedback (v1.1)
Asked: no create-account prominence / no password eye / no forgot password; subjects dropdown empty — wants every class KG→BS Hons with its subjects + ability to add custom; syllabus/book module (upload PDF once, page/section/topic stored, teachers pick by chapter & exercise question numbers); keep manual typing; board templates for Matric/Inter/Graduation + high-rated-school and govt patterns for KG–Primary; trial/Pro settings; copyright "Pajee Technologies".
Done: PasswordInput, forgot/reset (SMTP or admin reset link), curriculum seeding, Book library (uploader, viewer, auto-generate), builder "From textbook" + "by exercise & question no.", 26 templates, PlatformSetting-driven trial & plans, footer/LICENSE/terms.

### Request 4 — BISE Punjab engine (v1.2) — "add only these, change nothing else"
Asked (6 items): SUBJECT_TEMPLATES (Physics/Chem/Bio 60, CS 50, Maths 75 with Theorem, English 75, Urdu 75 RTL, Islamiat 100, Tarjuma 50); test scope Full/Half/Quarter/Custom + Smart Syllabus/ALP toggle + full vs scaled marks; A4/Legal/Letter with 12 mm margins and no overflow; header centred + metadata table; MCQ options never wrap onto the stem; strict MCQ/short/long filtering.
Done exactly that. English/Urdu/Islamiat/Tarjuma sub-section marks were the assistant's own split (the user's spec gave only totals); the user was told to verify them against board papers.

### Request 5 — Database savings audit (v1.3)
Asked: zero-PDF storage with IDs only; trial 14 days / 10 papers with upgrade prompt; 24 h client cache; selected columns, indexes, pooling.
Done: refs-only paper storage, trial gating + UpgradePrompt, IndexedDB cache, lean selects, 14 indexes, `connection_limit=1`.

### Request 6 — Trial change
"Trial one month, 20 papers. Super Admin without any trial or limit." → defaults 30 days / 20 papers; the Super Admin's institution is always unlimited, with no watermark.

### Request 7 — Developer-only Super Admin
"Give me a developers-only link with a clear message, or the right method via env variables; change nothing else." → `/developer` page (noindex, not linked, clear notice), requires `SUPER_ADMIN_SETUP_KEY`; `/register` no longer auto-promotes (this closed a hole where anyone registering first with that email became Super Admin).

### Request 8 — Live bugs from screenshots (v1.4)
Reported: auto-picked questions show as "deleted" on print; Edit reverts to "Custom chapters"; need to edit any question; numbers like 229, 254, 324 appear in MCQs; Smart Syllabus should auto-pick chapters and questions.
Root cause (reproduced on a local DB): the Super Admin could pick from **another school's private book**, but expand only allowed shared + own books. Fixed: same access rule + light text copy fallback. Also: `buildOptions` saved/restored, ✏️ edit, `cleanPages()` footer/page-number removal, 2-option-line MCQ fix, ♻️ Re-read (keeps IDs), Smart Syllabus bulk marking + auto-pick on tick.

### Request 9 — MCQ correct answers (v1.5)
Q: "Will auto-selected MCQs also pick a/b/c/d with the accurate answer?" Answer: options yes; the correct answer only if the book prints a key, because guessing without AI would be inaccurate. Done: answer-key detection, 🔑 Answer key one-line entry per exercise, auto-pick prefers answered MCQs, "answer not set" warning; fixed a bug where saving with no choice silently marked (a).

### Request 10 — Payment approval + documentation + this handoff
Explained TID approval (`/admin → Payments → Approve → PRO / Reject`; Institutions tab for manual Pro). The user's screenshot showed "Payment accounts are not set yet" → they must fill accounts in `/admin → Trial & Pro settings`. Created two Claude Docs (Owner & Super Admin Guide; School & Teacher User Guide) with real screenshots, and this file.

### Request 11 — Paper audit from the PCTB Computer 9th book (v1.6)
User's printed PDF showed: "PCTB Not for Sale", page numbers (240, 259) and stray words ("information", "credentials", "and others") in MCQ stems; option text cut; an MCQ inside the short section; "1." before a long question; the next unit's "Student Learning Outcomes" glued onto a long question. They also wanted the PDF to save with the paper's name instead of typing it in the Microsoft Print to PDF window.
Done: parser fixes in `lib/bookParse.ts` (watermark strip, printed-page-number offset detection, wrapped lines → last option, section-letter headings, inline a)/(a) options, `UNIT <title> <n>` headings, SECTION_END), rotated text skipped in `lib/pdfText.ts`, print-time watermark strip in `normalizeForSection`, `printWithName()` in `ExamPaperPreview.tsx`. Existing books need **♻️ Re-read questions** once. Advice given: use Destination **Save as PDF** (not Microsoft Print to PDF), the same paper size (the blank 6th page came from printing an A4 paper on Letter), untick "Headers and footers".

---

## 8. Known limitations / honest notes

- Handwritten-marks OCR (tesseract) is a helper; bubble reading is the reliable part.
- InPage-Urdu or scanned PDFs need the OCR option (slow); text quality varies.
- No AI answer generation (by design: free stack, accuracy). Answers come from book keys or teacher entry.
- The trial watermark is CSS (a deterrent, not DRM).
- English/Urdu/Islamiat/Tarjuma preset sub-marks need checking against real board papers.
- Payments are manual (no JazzCash/EasyPaisa API integration).
- Papers saved in v1.3 (before the text copy existed) whose source question was later deleted show "no longer available"; edit and replace those questions.
- In the builder, editing (✏️) a bank question that has an image creates a copy without the image (the builder list loads without image data).

## 9. Developer notes (sandbox testing recipe)

Prisma engine binaries (binaries.prisma.sh) were blocked in the assistant's sandbox. What worked:
- **Typecheck/build:** `PRISMA_QUERY_ENGINE_LIBRARY=/tmp/dummy.so.node PRISMA_SCHEMA_ENGINE_BINARY=/tmp/dummy.so.node PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1 npx prisma generate --no-engine`, then `npx tsc --noEmit` and `next build` with dummy env.
- **Real DB end-to-end:** a copy of the app with Prisma **6.19** `engineType="client"` + `@prisma/adapter-pg` (`max:1`), a database from **PGlite** (`npx pglite-server --db=/tmp/pgdata --port=5433`), tables from `prisma migrate diff --from-empty --to-schema-datamodel … --script` applied with `pg`; flows driven by Playwright + system Chrome. Don't ship the Prisma 6 changes; production stays on Prisma 5.22.
- Tests that exist (in the sandbox, not in the zip): synthetic OMR scans, printed-sheet OMR, book parser (chapters/MCQ/footers/answer keys), presets total marks, scope/scale, strict filtering, refs compaction size.
- For local npm installs, temporarily swap the `xlsx` CDN URL to `0.18.5` if the CDN is blocked, and restore it before zipping.

## 10. Ideas the user may ask for next (not built)

- Automatic JazzCash/EasyPaisa payment confirmation (needs merchant API).
- Official Smart Syllabus lists preloaded per book (currently marked by hand).
- End-of-book answer keys organised by chapter (only in-chapter keys are detected today).
- Question-wise analytics, duplicate-question detection, multi-version (A/B) papers, Urdu UI.
