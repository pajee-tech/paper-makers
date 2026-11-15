"use client";
// Copyright (c) Pajee Technologies. All rights reserved.
/**
 * Browser cache for read-mostly data (question bank, catalog, textbook library) — cuts repeat reads
 * on the free-tier database. Two layers: an in-memory Map (instant) + IndexedDB (survives reloads),
 * 24-hour TTL. No dependency. Falls back to memory only if IndexedDB is unavailable (private mode).
 *
 *  cachedGet(url)            → served from cache when fresh, otherwise fetched and stored
 *  invalidateCache("q:")     → after the teacher adds / edits / deletes something
 *  bindCacheOwner(userId)    → wipes the cache when a different account signs in on this browser
 */

export const DAY = 24 * 60 * 60 * 1000;
const DB = "papermaker-cache";
const STORE = "kv";
const mem = new Map<string, { at: number; v: unknown }>();
const inflight = new Map<string, Promise<unknown>>();

function idb(): Promise<IDBDatabase | null> {
  return new Promise((res) => {
    try {
      if (typeof indexedDB === "undefined") return res(null);
      const r = indexedDB.open(DB, 1);
      r.onupgradeneeded = () => r.result.createObjectStore(STORE);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}
let dbP: Promise<IDBDatabase | null> | null = null;
const db = () => (dbP ??= idb());

async function idbGet(key: string): Promise<{ at: number; v: unknown } | undefined> {
  const d = await db();
  if (!d) return undefined;
  return new Promise((res) => {
    try {
      const r = d.transaction(STORE, "readonly").objectStore(STORE).get(key);
      r.onsuccess = () => res(r.result);
      r.onerror = () => res(undefined);
    } catch { res(undefined); }
  });
}
async function idbPut(key: string, val: { at: number; v: unknown }) {
  const d = await db();
  if (!d) return;
  try { d.transaction(STORE, "readwrite").objectStore(STORE).put(val, key); } catch { /* quota full → memory only */ }
}
async function idbDeletePrefix(prefix: string) {
  const d = await db();
  if (!d) return;
  await new Promise<void>((res) => {
    try {
      const st = d.transaction(STORE, "readwrite").objectStore(STORE);
      const r = st.openCursor();
      r.onsuccess = () => {
        const c = r.result;
        if (!c) return res();
        if (String(c.key).startsWith(prefix)) c.delete();
        c.continue();
      };
      r.onerror = () => res();
    } catch { res(); }
  });
}

/** Cache keys: "<group>:<url>". Groups: q (question bank), cat (catalog), book (library). */
export function cacheKey(url: string) {
  const group = url.startsWith("/api/questions") ? "q" : url.startsWith("/api/catalog") ? "cat" : url.startsWith("/api/books") ? "book" : "misc";
  return `${group}:${url}`;
}

export async function cachedGet<T>(url: string, ttl = DAY): Promise<T> {
  const key = cacheKey(url);
  const m = mem.get(key);
  if (m && Date.now() - m.at < ttl) return m.v as T;
  const stored = await idbGet(key);
  if (stored && Date.now() - stored.at < ttl) {
    mem.set(key, stored);
    return stored.v as T;
  }
  if (inflight.has(key)) return inflight.get(key) as Promise<T>;
  const p = (async () => {
    const r = await fetch(url);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) throw Object.assign(new Error(d.error ?? `Request failed (${r.status})`), { status: r.status });
    const entry = { at: Date.now(), v: d };
    mem.set(key, entry);
    await idbPut(key, entry);
    return d as T;
  })().finally(() => inflight.delete(key));
  inflight.set(key, p);
  return p;
}

/** Drop cached entries whose key starts with prefix ("" = everything). */
export async function invalidateCache(prefix = "") {
  for (const k of [...mem.keys()]) if (k.startsWith(prefix)) mem.delete(k);
  await idbDeletePrefix(prefix);
}

/** Different user on this browser → start with an empty cache (no data leaks between accounts). */
export async function bindCacheOwner(userId: string) {
  try {
    const prev = localStorage.getItem("pm-cache-owner");
    if (prev !== userId) {
      await invalidateCache("");
      localStorage.setItem("pm-cache-owner", userId);
    }
  } catch { /* storage blocked */ }
}
