import Link from "next/link";

export default function NotFound() {
  return (
    <main className="container" style={{ paddingTop: 80, textAlign: "center" }}>
      <h1>Not found</h1>
      <p className="muted">This page or paper doesn&apos;t exist, or it belongs to another institution.</p>
      <Link className="btn" href="/dashboard">Back to dashboard</Link>
    </main>
  );
}
