# PaperMaker PK — Exam Paper Generator & Optional Instant Result Maker

For Pakistani schools, colleges, academies and degree institutes (Nursery → Graduation).
**100% free stack:** Next.js 14 (App Router) · NextAuth (credentials) · Prisma · Neon PostgreSQL Free Tier · Vercel Hobby.
There are no paid APIs. PDF reading, cropping, OMR bubble reading and OCR all run **in the teacher's browser**
(`pdfjs-dist`, `tesseract.js`, Canvas), so the app needs no file storage and has no per-use cost.

---

## 1. Run locally (about 10 minutes)

```bash
cp .env.example .env          # fill DATABASE_URL + DIRECT_URL from Neon, NEXTAUTH_SECRET, SUPER_ADMIN_EMAIL
npm install                   # also runs prisma generate + copies the pdf.js worker into /public
npx prisma db push            # creates the tables in Neon
npm run dev                   # http://localhost:3000
```

1. Register at `/register` with the email you set as `SUPER_ADMIN_EMAIL`. That account gets the **Super Admin** page (`/admin`).
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
