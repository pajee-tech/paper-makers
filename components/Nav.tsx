"use client";
import Link from "next/link";
import { signOut } from "next-auth/react";

const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "PaperMaker PK";

export default function Nav({ isSuper, plan }: { isSuper?: boolean; plan?: string }) {
  return (
    <nav className="topnav no-print">
      <div className="container">
        <Link href="/dashboard" className="brand">📝 {APP}</Link>
        <Link href="/dashboard">Papers</Link>
        <Link href="/dashboard/papers/new">New Paper</Link>
        <Link href="/dashboard/questions">Question Bank</Link>
        <Link href="/dashboard/billing">Billing</Link>
        <Link href="/dashboard/settings">Settings</Link>
        {isSuper && <Link href="/admin">Super Admin</Link>}
        <span className="spacer" />
        {plan && <span className={`badge ${plan === "PAPER_MAKER_PRO" ? "ok" : "warn"}`}>{plan === "PAPER_MAKER_PRO" ? "PRO" : "FREE TRIAL"}</span>}
        <button className="btn-sm btn-ghost" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
      </div>
    </nav>
  );
}
