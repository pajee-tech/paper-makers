import Link from "next/link";
import PublicHeader from "@/components/PublicHeader";

const APP = process.env.NEXT_PUBLIC_APP_NAME ?? "PaperMaker PK";

export default function Home() {
  const features = [
    ["Playgroup to BS (Hons)", "Every class and its subjects ready on day one. Match the columns, blanks, true/false, missing letters, dictation, 4-line & square tracing, BISE Part-I/Part-II, semester papers, case studies and code."],
    ["Print in 5 sizes", "A4, Legal, Letter, Folio/Foolscap and A5 2-per-sheet quizzes. Portrait/landscape, 1 or 2 columns, font size, answer key, OMR sheet."],
    ["Textbook & syllabus library", "Books saved page by page with chapters, topics and exercises. Teachers pick a chapter and exercise question numbers — the paper writes itself."],
    ["Urdu & Math", "Proper Nastaliq Urdu (right-to-left) and KaTeX equations for Science and Maths papers."],
    ["Optional instant result", "Type marks, upload Excel/CSV, or scan checked OMR sheets. Get %, grade, pass/fail, positions, award list and 4-per-page result slips."],
    ["WhatsApp parents", "One click sends each student's marks to parents through WhatsApp — free."],
  ];
  return (
    <>
    <PublicHeader />
    <main>
      <div className="container hero">
        <span className="badge">For Pakistani schools, colleges & academies</span>
        <h1 style={{ marginTop: 12 }}>{APP}: exam papers in minutes, class results in seconds.</h1>
        <p className="muted" style={{ fontSize: 16, maxWidth: 720 }}>
          Build board-style papers from your own question bank, print on any paper size, and — only if you want — turn checked answer sheets into a complete class result.
        </p>
        <div className="row" style={{ marginTop: 18 }}>
          <Link className="btn" href="/register">Start free — 3 papers</Link>
          <Link className="btn btn-ghost" href="/demo">See a live demo paper</Link>
          <Link className="btn btn-ghost" href="/login">Sign in</Link>
        </div>
      </div>
      <div className="container grid3">
        {features.map(([t, d]) => (
          <div className="card" key={t} style={{ marginTop: 0 }}>
            <h3>{t}</h3>
            <p className="muted" style={{ margin: 0 }}>{d}</p>
          </div>
        ))}
      </div>
      <div className="container small muted" style={{ textAlign: "center", padding: 40 }}>Pro plan: pay by JazzCash, EasyPaisa or bank transfer. <Link href="/register">Start your free trial</Link></div>
    </main>
    </>
  );
}
