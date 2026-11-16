import type { Metadata } from "next";
import DeveloperSetup from "./DeveloperSetup";
import { developerSetupEnabled } from "@/lib/developer";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Developer access", robots: { index: false, follow: false } };

/** Developer-only Super Admin setup. Not linked from anywhere in the app. */
export default function DeveloperPage() {
  return (
    <main className="container" style={{ maxWidth: 560, paddingTop: 40 }}>
      <div className="alert err" style={{ fontSize: 15 }}>
        <b>🔒 Developers only.</b> This page is for the PaperMaker PK developer (Pajee Technologies) to set up the platform&apos;s Super Admin account.
        It is <b>not</b> for schools, colleges, academies or teachers. If you want to use PaperMaker PK, please <a href="/register">create a free account</a> or <a href="/login">sign in</a>.
      </div>
      {developerSetupEnabled() ? (
        <DeveloperSetup />
      ) : (
        <div className="card">
          <h1>Developer setup is switched off</h1>
          <p className="muted">To enable it, the developer sets <code>SUPER_ADMIN_EMAIL</code> and <code>SUPER_ADMIN_SETUP_KEY</code> (at least 16 characters) in the hosting environment variables and redeploys.</p>
        </div>
      )}
    </main>
  );
}
