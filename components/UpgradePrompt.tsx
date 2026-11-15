// Copyright (c) Pajee Technologies. All rights reserved.
import Link from "next/link";

/** Shown whenever the trial quota / period blocks an action. */
export default function UpgradePrompt({ message, used, limit, daysLeft }: { message: string; used?: number; limit?: number; daysLeft?: number | null }) {
  return (
    <div className="card" style={{ borderColor: "#f59e0b", borderWidth: 2, background: "#fffbeb" }}>
      <h2 style={{ marginTop: 0 }}>🚀 Upgrade to PaperMaker Pro</h2>
      <p style={{ margin: "0 0 8px" }}>{message}</p>
      {limit != null && used != null && (
        <div style={{ margin: "8px 0 12px" }}>
          <div className="small muted">Free trial: {used} / {limit} papers{daysLeft != null ? ` · ${daysLeft} day${daysLeft === 1 ? "" : "s"} left` : ""}</div>
          <div style={{ height: 8, background: "#fde68a", borderRadius: 8, overflow: "hidden" }}>
            <div style={{ width: `${Math.min(100, (used / Math.max(1, limit)) * 100)}%`, height: "100%", background: "#d97706" }} />
          </div>
        </div>
      )}
      <p className="small muted">Your saved papers stay safe — you can still open and reprint them. Pro removes the watermark and unlocks unlimited papers.</p>
      <Link className="btn" href="/dashboard/billing">See Pro plans →</Link>
    </div>
  );
}
