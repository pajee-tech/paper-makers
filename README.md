# PaperMaker PK — Exam Paper Generator & Optional Instant Result Maker

© Pajee Technologies. All rights reserved. Proprietary software — see `LICENSE`.

For Pakistani schools, colleges, academies and degree institutes (Nursery → Graduation).
**100% free stack:** Next.js 14 (App Router) · NextAuth (credentials) · Prisma · Neon PostgreSQL Free Tier · Vercel Hobby.
There are no paid APIs. PDF reading, cropping, OMR bubble reading and OCR all run **in the teacher's browser**
(`pdfjs-dist`, `tesseract.js`, Canvas), so the app needs no file storage and has no per-use cost.

---

## What's new (v1.6) — cleaner book questions & PDF file name

- **Book reader:** "PCTB Not for Sale" and other watermarks are removed even when the PDF glues them into a question line; printed page numbers (e.g. 240, 259) are found per book and removed from the start/end of lines; wrapped option text ("… steal your" / "information") now joins the option instead of the question; "B. Long questions." is a heading, not option (b); a leftover "1." at the start of a question is removed; options typed inline in a question ("(a) … (b) … (c) …" or "a) … b) …") become a proper MCQ; the next unit's opening ("UNIT Entrepreneurship in Digital Age 12", "Student Learning Outcomes", "By the end of this chapter") ends the exercise so it is never glued to the last long question.
- New uploads also skip rotated (side/diagonal) watermark text.
- Books uploaded earlier: open the book → **♻️ Re-read questions** once. Saved papers pick up the clean text automatically (same question IDs); watermark phrases are also removed at print time.
- **Print → PDF file name:** the print button sets the document title to e.g. `9th - Computer Science - Full Book Test - Annual - 16 Dec 2026`, so Chrome/Edge **Save as PDF** fills the file name in.

## What's new (v1.5) — MCQ correct answers

| Feature | Where |
|---|---|
| **Options + correct answer come in automatically.** MCQ options (a)–(d) are read from the book. If a chapter prints an **Answers / Answer Key** block (`(i) a (ii) b`, `1. b 2. c`, `جوابات`), the correct options are set automatically on upload and on ♻️ Re-read. | `lib/bookParse.ts` (`parseAnswerTokens`, `applyAnswerKey`) |
| **🔑 Answer key** per exercise in Book Library: type the answers once in one line (`b c a d`, `bcad` or `1b 2c 3a`). Every paper made from that book then has correct answers. Re-read keeps answers you typed. | `BookViewer.tsx`, `PUT /api/books/[id]/items` |
| **Auto-pick prefers MCQs that have an answer.** The builder shows the correct option with ✓ and warns "answer not set — click ✏️" for the rest. A question with no answer chosen is never silently marked (a). | `PaperBuilder.tsx`, `QuestionForm.tsx` |

## What's new (v1.4) — fixes from live testing

| Fix | Where |
|---|---|
| **Printed papers no longer show "deleted" questions.** The cause: the Super Admin could pick questions from any school's book in the builder, but printing only looked in shared and own-school books. Printing now uses the same access rule as the builder. Each saved reference also keeps a small text-only copy (no images), so a question still prints if its source is later deleted or changed. | `lib/paperRefs.ts` |
| **Edit reopens exactly as built**: test scope (Full/Half/Quarter), Smart Syllabus, marks mode, book, chapters and question sources are saved with the paper (`SavedPaper.buildOptions`). Older papers open as Custom. | `components/PaperBuilder.tsx`, `prisma/schema.prisma` |
| **Edit any question inside a paper** with ✏️, whether auto-picked, from the book or typed. The change applies to that paper only; the bank and book stay unchanged. | `PaperBuilder.tsx` |
| **No page numbers or footers in questions.** The book reader removes bare page numbers (229, 254…) and lines repeated on many pages ("PCTB Not for Sale"). It also reads MCQs whose options are split over two lines. **♻️ Re-read questions** in Book Library re-reads saved books; it keeps question IDs (so existing papers keep working), Smart Syllabus marks, and teacher-added or generated questions. | `lib/bookParse.ts`, `BookViewer.tsx`, `app/api/books/[id]/structure` |
| **Smart Syllabus**: in Book Library and Question Bank, **📋 Smart Syllabus chapters** marks chapters in one go (e.g. `1, 2, 4-6`). In New Paper, ticking **Smart Syllabus / ALP only** picks those chapters and **auto-selects the questions**. | `BookViewer.tsx`, `QuestionBank.tsx`, `PaperBuilder.tsx` |

## What's new (v1.3) — database savings & trial control

| Mechanism | How it works | Where |
|---|---|---|
| **No PDF/HTML in the DB, question IDs only** | PDFs are made in the browser. `SavedPaper.sections` now stores `{ id, ref: "q"\|"b", type, marks }` for question-bank and textbook questions. Only teacher-typed custom questions keep their text. References are resolved (2 indexed queries) when a paper is opened, reprinted or used for results. Older papers that stored full copies still open unchanged. A paper with one diagram went from about 123 KB to about 1.4 KB. | `lib/paperRefs.ts`, `app/api/papers/*` |
| **Trial: 30 days + 20 papers** | Default trial is 20 papers and 30 days (`FREE_TRIAL_DAYS`, `FREE_TRIAL_PAPER_LIMIT`, or change them live in `/admin`). `papersCreated` goes up by one each time a paper is generated; reprinting a saved paper is free. When the trial is used up or expired, the API returns 402 and New Paper shows an "Upgrade to Pro" screen. After expiry, results, OMR and library uploads are locked too, but saved papers can still be opened and reprinted. | `lib/plan.ts`, `components/UpgradePrompt.tsx` |
| **24-hour browser cache** | The question bank, catalog and textbook library are cached in IndexedDB (plus memory) for 24 hours. Any add, edit or delete automatically clears the affected cache. New Paper has a "↻ Refresh questions" button. The cache is wiped on sign-out or when a different account signs in. | `lib/clientCache.ts`, `components/useCatalog.ts` |
| **Lean queries, indexes, pooling** | Builder lists skip image data (`?full=1` only on the bank and library screens). Catalog and dashboard use `select`. New indexes: Chapter(subjectId), SavedPaper(classId/subjectId), User(institutionId), result sessions, payments, book tables. There is one Prisma client per serverless instance, and Neon's pooled URL uses `connection_limit=1&pool_timeout=20`. | `prisma/schema.prisma`, `app/api/*`, `lib/prisma.ts`, `.env.example` |

> **Note:** if you already saved Trial settings in `/admin` before this update, those saved values win over the new defaults. Set them to 20 papers / 30 days there. The Super Admin's own institution is always unlimited (no trial, no expiry, no watermark).
> **Vercel:** update `DATABASE_URL` to add `&connection_limit=1&pool_timeout=20` at the end.

## What's new (v1.2) — BISE Punjab engine

| Feature | Where |
|---|---|
| **Subject presets (`SUBJECT_TEMPLATES`)**: for 9th/10th, choosing the subject loads the BISE Punjab pattern. Physics/Chemistry/Biology are 60 marks (12 MCQs + 3 × short "5 of 8" + long "2 of 3 × 9" with (a)/(b) parts). Computer Science is 50, Mathematics 75 (with a compulsory Theorem question), English 75, Urdu 75 (RTL), Islamiat Compulsory 100 (RTL) and Tarjuma-tul-Quran 50 (RTL). These also appear in the template list. | `lib/subjectTemplates.ts` |
| **Test scope**: Full Book, 1st Half, 2nd Half, Quarter (1st–4th) or Custom chapters, plus a **Smart Syllabus / ALP only** toggle. Chapters are marked ALP in Question Bank / Book Library. You can keep the full board-pattern marks or scale question counts and marks to the scope. The title is filled in automatically (e.g. "First Half Book Test"). | `lib/scope.ts`, `components/PaperBuilder.tsx` |
| **Page sizes**: A4 (8.27 × 11.69 in), Legal (8.5 × 14 in) and Letter (8.5 × 11 in), plus the existing Folio and A5 2-up. A dynamic `@page` rule is used, the default margin is now 12 mm, and `box-sizing: border-box` with no horizontal overflow. | `lib/paperSizes.ts`, `app/globals.css` |
| **Header fix**: the logo, school name, exam title and subject/paper type are centred. Name, Roll No, Class, Section, Date, Time Allowed and Maximum Marks go in a full-width, left-aligned bordered table. | `ExamPaperPreview.tsx` → `PaperHeader` |
| **MCQ layout fix**: each MCQ is its own block that won't split across pages. The stem is full width, and the options sit below in a strict 4-column row or a 2 × 2 grid, so they can never wrap onto the question line. | `ExamPaperPreview.tsx`, `.opts` CSS |
| **Strict question-type filtering**: MCQs only go in MCQ sections, short only in short and long only in long. Options are removed outside MCQ sections. This is enforced in the builder's question pools, when a paper is saved (API) and when it is printed. | `lib/questionRules.ts` |

## What's new (v1.1)

| Feature | Where |
|---|---|
| **Show/hide password** eye on login, register, reset and teacher forms | `components/PasswordInput.tsx` |
| **Forgot password**: email link via free SMTP (Gmail App Password), or a **one-time link the Super Admin creates** (`/admin → Users`) and sends on WhatsApp. Institution admins can also set a teacher's password. | `app/forgot-password`, `app/reset-password`, `app/api/password/*`, `lib/passwordReset.ts` |
| **Every class, Playgroup → BS (Hons), with standard subjects** is created for each new institution. Older accounts get them automatically too, or from *Settings → Load standard classes & subjects*. Teachers can add their own class or subject with the **+** next to the dropdowns in *New Paper*. | `lib/curriculum.ts`, `lib/seed.ts` |
| **Textbook & syllabus library**: upload a book PDF once. Each page's text is saved, along with its chapters, topics (1.1, 1.2…), exercises and numbered questions (MCQ options, (i)(ii) sub-numbers and blanks are detected). There is optional free OCR (English/Urdu) for scanned pages. Super Admin books go to a **shared library** every school can use. | `components/BookUploader.tsx`, `lib/bookParse.ts`, `app/api/books/*` |
| **Library viewer**: browse chapters, fix question types, turn selected page lines into questions, search the whole book, and **auto-generate** Define / Fill-in-the-blank / True-False questions (with answers) from definition sentences. This is free and uses no AI service. | `components/BookViewer.tsx` |
| **New Paper → "From textbook"**: pick the book and chapters, then auto-pick questions or use **📘 Add by exercise & question no.** (e.g. *Exercise 2.1 → 1-5, 8*). Your question bank and your own typed questions still work alongside. | `components/PaperBuilder.tsx` |
| **26 paper templates** in groups: Montessori/Early Years (English, Maths, Urdu, oral), Primary (govt SED/PEC style, premium private style, Maths, Science/GK, Urdu), Middle, Punjab Boards (new SLO 60-mark, classic 75-mark, Arts), FBISE SSC/HSSC and the new 50% objective pattern, Inter Science/Arts, BS/ADP mid and final, BA annual, quick tests | `lib/templates.ts` |
| **Trial & Pro settings without redeploying** (`/admin → Trial & Pro settings`): free paper count, trial days, watermark text, which features the trial includes (results / OMR / library), user limits, any number of Pro plans with prices, and payment accounts | `lib/settings.ts`, `lib/plan.ts` |
| **Copyright**: Pajee Technologies footer on every page, `/terms`, `LICENSE`, and "by Pajee Technologies" in the trial watermark | `components/Footer.tsx` |

Database: `npm run build` runs `prisma db push`, so new tables are created on each Vercel deploy. The changes only add tables and columns; existing data is kept.

## 1. Run locally (about 10 minutes)

```bash
cp .env.example .env          # fill DATABASE_URL + DIRECT_URL from Neon, NEXTAUTH_SECRET, SUPER_ADMIN_EMAIL
npm install                   # also runs prisma generate + copies the pdf.js worker into /public
npx prisma db push            # creates the tables in Neon
npm run dev                   # http://localhost:3000
```

1. **Super Admin (developers only):** set `SUPER_ADMIN_EMAIL` and `SUPER_ADMIN_SETUP_KEY` (16+ characters), open `/developer`, then enter the key, that email and a password. The page isn't linked anywhere, has a clear "Developers only" notice, and is hidden from search engines. Normal `/register` always creates a school account. Remove `SUPER_ADMIN_SETUP_KEY` afterwards to switch `/developer` off.
2. Register a second, normal institution to test the free trial.
3. Open `/demo` to see the print engine without logging in.

> **`xlsx` note:** `package.json` installs SheetJS from its official CDN tarball (`cdn.sheetjs.com`), as SheetJS recommends,
> because the npm `xlsx@0.18.5` is outdated. If your network blocks that URL, change it to `"xlsx": "0.18.5"`. The API is the same.

## 2. Deploy (Neon + Vercel, free)

1. **Neon** → create a project (Singapore `ap-southeast-1` is the closest region to Pakistan). Copy the **pooled** connection string into `DATABASE_URL`
   (add `&pgbouncer=true&connect_timeout=15`) and the **direct** string into `DIRECT_URL`.
2. Push this folder to GitHub, then import it in **Vercel**. Add every variable from `.env.example` in *Settings → Environment Variables*
   and set `NEXTAUTH_URL` to your production URL.
3. Run `npx prisma db push` once against the production database (from your machine with the prod env), or switch to
   `prisma migrate dev` / `migrate deploy` when you want versioned migrations.
4. Fill the `NEXT_PUBLIC_PAY_*` variables with your JazzCash / EasyPaisa / bank details and redeploy.

## 3. What's where

| Area | Files |
|---|---|
| Schema | `prisma/schema.prisma` — `Institution`, `User`, `AcademicClass` (`EARLY_YEARS`…`GRADUATION`), `Subject`, `Chapter`, `Question` (`matchPairs`, `imageSnippet`, `needsLines`, `urduText`), `SavedPaper` (`WEEKLY`…`SEMESTER`), `PaperResultSession`, `StudentPaperScore`, `PaymentRequest` |
| Auth | `lib/auth.ts`, `app/api/auth/[...nextauth]`, `app/api/register`, `middleware.ts` (protects `/dashboard`, `/admin`) |
| Question bank | `components/QuestionBank.tsx`, `components/QuestionForm.tsx`, `app/api/catalog`, `app/api/questions` |
| Textbook PDF extractor | `components/PdfBookPaperExtractor.tsx` (pdfjs-dist; text → drafts; drag-crop → compressed WebP) |
| Paper builder | `components/PaperBuilder.tsx`, `lib/templates.ts` (Early Years, Primary, BISE Matric, BISE Inter, Semester, Annual BA/BSc, Weekly quiz) |
| **Print engine** | `components/ExamPaperPreview.tsx`, `lib/paperSizes.ts`: A4 · Legal · Letter · A5 2-up · Folio, portrait/landscape, 1/2 columns, font size, margin, answer key, OMR. A dynamic `@page` rule is injected. The OMR sheet uses a named `@page omr` so it always prints portrait. |
| Rendering | `MathText.tsx` (KaTeX `$…$`, `$$…$$`, ```code```, `___` blanks), Urdu `Noto Nastaliq Urdu` RTL, `TracingLines.tsx` (4-line English / square math, as SVG so it always prints), `SvgIcons.tsx` (16 original line-art icons), `OmrSheet.tsx` |
| **Optional results** | `components/CheckedPdfResultCounter.tsx` (manual grid · Excel/CSV · scanned-PDF OMR + OCR), `lib/omrScan.ts`, `lib/omrLayout.ts`, `components/ResultPrintouts.tsx` (award list A4/Legal, 4-per-page slips, `wa.me` links), `lib/grading.ts`, `app/api/results/[id]` |
| Monetization | `lib/plan.ts` (3 free papers, then 402), watermark on trial papers, `app/dashboard/billing`, `app/api/billing`, `app/admin` + `app/api/admin/payments` (approve/reject TID, direct PRO toggle with months) |

### The result feature is optional
Teachers who only print papers never see an extra step. The **"Generate Class Result (Optional)"** button on a paper's
print page opens (or creates) a `PaperResultSession`.

### How the PDF auto-count works
1. Print the paper with **OMR bubble sheet** ticked. Students fill bubbles. The examiner writes the subjective marks (and the grand total) in the boxes on the OMR sheet.
2. Scan all checked sheets into one PDF. Set *pages per student* and *which page is the OMR* if you scanned whole answer books.
3. For each sheet, the browser does this: pdf.js renders the page → the 4 corner markers are found as solid square blobs → a bilinear map places every
   bubble (this tolerates small rotation, skew and scaling) → ink darkness per bubble gives the roll number and the answers (blank and double-filled score 0, negative marking is optional)
   → tesseract.js reads the digits in the marks boxes → a verification table with an overlay image (green = correct, red = wrong, amber = double-filled) → the teacher fixes anything flagged and applies the results.
4. Rows are matched by roll number to the class list (typed or imported from Excel).

Geometry is shared by the printer (`OmrSheet.tsx`) and the reader (`omrScan.ts`) through `lib/omrLayout.ts`. **If you change the layout, change it there only.**

## 4. Tested
- `tsc --noEmit` and `next build` pass.
- OMR reader, synthetic scans: clean, ±1.5–2° rotation, 96% scaling, blank, wrong, double-filled, and faint pencil marks were all read correctly.
- OMR reader, end to end: Chrome printed the `/demo` paper to PDF, the page was rasterized at 150 dpi and bubbles were filled. The roll number and all answers were read correctly, with the trial watermark present.

## 5. Known limits (be honest with customers)
- **Handwriting OCR** with free Tesseract works on clear, separate digits. It is a helper, not a guarantee, which is why every value is shown for confirmation.
  Bubble reading (MCQs, roll number) is the reliable part.
- **A5 2-up** is for short quizzes. The page warns when a paper is longer than one half-page.
- **Urdu text** inside InPage-made PDFs usually can't be extracted as text. Crop it as an image snippet instead (this is built in).
- The trial watermark is CSS. That's fine for a light deterrent, but it isn't DRM.
- Tesseract downloads its free English model (~10 MB) from the jsDelivr CDN the first time OCR is used. After that the browser caches it.

## 6. If you already have `schema.prisma` / `PdfBookPaperExtractor.tsx`
This build was written to the model and field names in the spec. If your copies differ:
- **Schema:** keep yours and add any missing fields/models from this file (`PaymentRequest`, `Institution.plan/proUntil/papersCreated`, `Question.options/correctOption/answer/icon/lineStyle/lineCount`).
- **Extractor:** your component only has to call `onSave(drafts: DraftQuestion[])` (see `components/QuestionForm.tsx` for the `DraftQuestion` shape).

## 7. One-week launch checklist
- Day 1: Neon + Vercel live, custom domain, payment variables filled.
- Day 2–3: Enter 2–3 subjects' question banks for your first customer classes (the PDF extractor speeds this up).
- Day 4: Print test papers on real A4, Legal and Folio printers, and check the print dialog shows *Margins: Default, Scale: 100%*.
- Day 5: Pilot the OMR scan with 10 real checked sheets from a phone scanner app.
- Day 6–7: Onboard 3 pilot schools on the trial, then approve their first JazzCash TIDs from `/admin`.
