// Copies the pdf.js worker into /public so the browser can load it from our own
// domain (no CDN, no cost, works offline after first load).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const src = join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.min.mjs");
const destDir = join(process.cwd(), "public");
if (!existsSync(src)) {
  console.warn("[copy-pdf-worker] pdfjs-dist worker not found, skipping");
  process.exit(0);
}
mkdirSync(destDir, { recursive: true });
copyFileSync(src, join(destDir, "pdf.worker.min.mjs"));
console.log("[copy-pdf-worker] copied pdf.worker.min.mjs -> public/");
