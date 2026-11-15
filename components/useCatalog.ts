"use client";
import { useCallback, useEffect, useState } from "react";
import type { Level } from "@/lib/types";

export interface CatChapter { id: string; number: number; title: string; _count: { questions: number } }
export interface CatSubject { id: string; name: string; isUrdu: boolean; chapters: CatChapter[] }
export interface CatClass { id: string; name: string; level: Level; subjects: CatSubject[] }

export function useCatalog() {
  const [classes, setClasses] = useState<CatClass[]>([]);
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    const r = await fetch("/api/catalog");
    const d = await r.json();
    setClasses(d.classes ?? []);
    setLoading(false);
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);
  return { classes, loading, reload };
}

export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.issues?.join(", ") ?? d.error ?? `Request failed (${r.status})`);
  return d as T;
}
