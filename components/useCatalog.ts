"use client";
import { useCallback, useEffect, useState } from "react";
import { cachedGet, invalidateCache } from "@/lib/clientCache";
import type { Level } from "@/lib/types";

export interface CatChapter { id: string; number: number; title: string; isAlp?: boolean; _count: { questions: number } }
export interface CatSubject { id: string; name: string; isUrdu: boolean; chapters: CatChapter[] }
export interface CatClass { id: string; name: string; level: Level; subjects: CatSubject[] }

/** Classes → subjects → chapters, served from the 24h browser cache; reload() always refetches. */
export function useCatalog() {
  const [classes, setClasses] = useState<CatClass[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async (fresh: boolean) => {
    if (fresh) await invalidateCache("cat:");
    const d = await cachedGet<{ classes: CatClass[] }>("/api/catalog").catch(() => ({ classes: [] as CatClass[] }));
    setClasses(d.classes ?? []);
    setLoading(false);
  }, []);
  const reload = useCallback(() => load(true), [load]);
  useEffect(() => {
    load(false);
  }, [load]);
  return { classes, loading, reload };
}

/** Which cached groups a write to this URL makes stale. */
function staleGroups(url: string): string[] {
  if (url.startsWith("/api/questions")) return ["q:", "cat:"]; // chapter question counts live in the catalog
  if (url.startsWith("/api/catalog")) return ["cat:", "q:"];
  if (url.startsWith("/api/books")) return ["book:"];
  return [];
}

/**
 * JSON fetch helper. GETs go straight to the server (use cachedGet for cacheable reads);
 * every write automatically invalidates the browser cache it affects.
 */
export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (method !== "GET") for (const g of staleGroups(url)) await invalidateCache(g);
  if (!r.ok) throw Object.assign(new Error(d.issues?.join(", ") ?? d.error ?? `Request failed (${r.status})`), { status: r.status });
  return d as T;
}
