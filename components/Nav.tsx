"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { useEffect } from "react";
import { bindCacheOwner, invalidateCache } from "@/lib/clientCache";

const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "PaperMaker PK";

export default function Nav({ isSuper, plan, userId }: { isSuper?: boolean; plan?: string; userId?: string }) {
  useEffect(() => { if (userId) bindCacheOwner(userId); }, [userId]);
  return (
    <nav className="topnav no-print">
      <div className="container">
        <Link href="/dashboard" className="brand">📝 {APP}</Link>
        <Link href="/dashboard">Papers</Link>
        <Link href="/dashboard/papers/new">New Paper</Link>
        <Link href="/dashboard/questions">Question Bank</Link>
        <Link href="/dashboard/library">Book Library</Link>
        <Link href="/dashboard/billing">Billing</Link>
        <Link href="/dashboard/settings">Settings</Link>
        {isSuper && <Link href="/admin">Super Admin</Link>}
        <span className="spacer" />
        {plan && <span className={`badge ${plan === "PAPER_MAKER_PRO" ? "ok" : "warn"}`}>{plan === "PAPER_MAKER_PRO" ? "PRO" : "FREE TRIAL"}</span>}
        <button className="btn-sm btn-ghost" onClick={async () => { await invalidateCache(""); signOut({ callbackUrl: "/" }); }}>Sign out</button>
      </div>
    </nav>
  );
}
