"use client";
// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * Keeps a book's PDF in this browser (IndexedDB) after upload, so Book Library can OCR it chapter by chapter
 * later without asking for the file again. Nothing is uploaded; on another computer the teacher picks the PDF once.
 */
const DB = "pm-book-pdfs";
const STORE = "files";

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(STORE);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

export async function savePdf(bookId: string, file: Blob): Promise<boolean> {
  try {
    const db = await open();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(file, bookId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return true;
  } catch {
    return false; // private window / storage full — OCR later just asks for the file
  }
}

export async function loadPdf(bookId: string): Promise<Blob | null> {
  try {
    const db = await open();
    const blob = await new Promise<Blob | null>((resolve, reject) => {
      const r = db.transaction(STORE, "readonly").objectStore(STORE).get(bookId);
      r.onsuccess = () => resolve((r.result as Blob) ?? null);
      r.onerror = () => reject(r.error);
    });
    db.close();
    return blob;
  } catch {
    return null;
  }
}
