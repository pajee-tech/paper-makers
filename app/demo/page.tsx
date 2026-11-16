import Link from "next/link";
import ExamPaperPreview from "@/components/ExamPaperPreview";
import { DEMO_PAPER, DEMO_PRIMARY } from "@/lib/demoPaper";

/** Public sample — lets visitors try sizes, columns, OMR and answer key without signing up. */
export default function DemoPage({ searchParams }: { searchParams: { level?: string } }) {
  const paper = searchParams.level === "kg" ? DEMO_PRIMARY : DEMO_PAPER;
  return (
    <main className="container">
      <div className="row no-print" style={{ margin: "10px 0" }}>
        <b>Live demo</b>
        <Link href="/demo">Matric (BISE)</Link>
        <Link href="/demo?level=kg">KG activity paper</Link>
        <span className="spacer" />
        <Link className="btn" href="/register">Create your own — free</Link>
      </div>
      <ExamPaperPreview paper={paper} editable={false} />
    </main>
  );
}
