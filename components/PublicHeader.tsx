import Link from "next/link";

const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "PaperMaker PK";

/** Header for public pages: brand + Sign in + Create account. */
export default function PublicHeader() {
  return (
    <nav className="topnav no-print">
      <div className="container">
        <Link href="/" className="brand">📝 {APP}</Link>
        <Link href="/demo">Live demo</Link>
        <span className="spacer" />
        <Link href="/login">Sign in</Link>
        <Link href="/register" className="btn btn-sm" style={{ color: "#fff" }}>Create free account</Link>
      </div>
    </nav>
  );
}
