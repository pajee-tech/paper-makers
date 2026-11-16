// Copyright (c) Pajee Technologies. All rights reserved.
import Link from "next/link";
import { APP_VERSION, EDITION } from "@/lib/edition";

const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "PaperMaker PK";

export default function Footer() {
  const y = new Date().getFullYear();
  return (
    <footer className="no-print" style={{ borderTop: "1px solid var(--line)", marginTop: 40, background: "#fff" }}>
      <div className="container row small muted" style={{ paddingTop: 16, paddingBottom: 16 }}>
        <span>© {y} <b>Pajee Technologies</b>. All rights reserved.</span>
        <span>{APP} is a product of Pajee Technologies. Unauthorised copying or resale of this software is prohibited.</span>
        <span className="spacer" />
        <span title="App version — check this after every upload to Vercel">v{APP_VERSION}{EDITION === "test" ? " · testing edition" : ""}</span>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  );
}
