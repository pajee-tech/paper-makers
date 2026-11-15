"use client";
// Browser-only helpers: compress any canvas/image to a small WebP data URL (JPEG fallback).

export function canvasToCompressed(src: HTMLCanvasElement, maxW = 900, quality = 0.72): string {
  const scale = Math.min(1, maxW / src.width);
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  const ctx = c.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const webp = c.toDataURL("image/webp", quality);
  return webp.startsWith("data:image/webp") ? webp : c.toDataURL("image/jpeg", quality);
}

export async function fileToCompressed(file: File, maxW = 900, quality = 0.72): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = rej;
      i.src = url;
    });
    const c = document.createElement("canvas");
    c.width = img.naturalWidth;
    c.height = img.naturalHeight;
    c.getContext("2d")!.drawImage(img, 0, 0);
    return canvasToCompressed(c, maxW, quality);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Load pdf.js lazily from our own /public worker (copied at install). */
export async function loadPdfJs() {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  return pdfjs;
}
