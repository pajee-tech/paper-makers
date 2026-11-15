"use client";
import { useEffect, useState } from "react";
import { classSummary, ordinal, whatsappLink } from "@/lib/grading";
import type { PaperDTO, ScoreRow } from "@/lib/types";

type View = "award" | "slips" | "whatsapp";

function useResultPageCss(size: "A4" | "LEGAL") {
  useEffect(() => {
    const el = document.createElement("style");
    el.id = "result-page-rule";
    el.textContent = `@page { size: ${size === "A4" ? "210mm 297mm" : "216mm 356mm"}; margin: 8mm; }`;
    document.head.appendChild(el);
    return () => el.remove();
  }, [size]);
}

function Heading({ paper }: { paper: PaperDTO }) {
  return (
    <div style={{ textAlign: "center", marginBottom: "3mm" }}>
      <div style={{ fontSize: "15pt", fontWeight: 800, textTransform: "uppercase" }}>{paper.institution.name}</div>
      <div style={{ fontSize: "12pt", fontWeight: 700 }}>Result Award List — {paper.title}</div>
      <div style={{ fontSize: "10pt" }}>{[paper.className && `Class: ${paper.className}`, paper.subjectName && `Subject: ${paper.subjectName}`].filter(Boolean).join("   •   ")}</div>
    </div>
  );
}

export function slipMessage(paper: PaperDTO, r: ScoreRow, total: number) {
  return [
    `Assalam-o-Alaikum. ${paper.institution.name}`,
    `${paper.title}${paper.subjectName ? ` — ${paper.subjectName}` : ""}${paper.className ? ` (${paper.className})` : ""}`,
    `Student: ${r.studentName || "-"} (Roll No ${r.rollNo})`,
    r.absent ? "Status: ABSENT" : `Marks: ${r.obtained}/${total} (${r.percentage}%) — Grade ${r.grade} — ${r.passed ? "PASS" : "FAIL"}${r.position ? ` — Position ${ordinal(r.position)}` : ""}`,
    "JazakAllah.",
  ].join("\n");
}

export default function ResultPrintouts({ paper, rows, totalMarks, passPercent }: { paper: PaperDTO; rows: ScoreRow[]; totalMarks: number; passPercent: number }) {
  const [view, setView] = useState<View>("award");
  const [size, setSize] = useState<"A4" | "LEGAL">("A4");
  const [sortBy, setSortBy] = useState<"roll" | "position">("roll");
  useResultPageCss(view === "slips" ? "A4" : size);
  const sum = classSummary(rows);
  const hasParts = rows.some((r) => r.mcqObtained != null || r.subjectiveObtained != null);
  const sorted = [...rows].sort((a, b) =>
    sortBy === "position" ? (a.position ?? 9999) - (b.position ?? 9999) : (Number(a.rollNo) || 0) - (Number(b.rollNo) || 0) || a.rollNo.localeCompare(b.rollNo),
  );
  const toppers = [...rows].filter((r) => r.position && r.position <= 3).sort((a, b) => a.position! - b.position!);
  const pages: ScoreRow[][] = [];
  for (let i = 0; i < sorted.length; i += 4) pages.push(sorted.slice(i, i + 4));

  return (
    <div>
      <div className="card no-print">
        <div className="row">
          <div className="tabs" style={{ margin: 0, border: "none" }}>
            <button className={view === "award" ? "active" : ""} onClick={() => setView("award")}>Award List</button>
            <button className={view === "slips" ? "active" : ""} onClick={() => setView("slips")}>Result Slips (4 per page)</button>
            <button className={view === "whatsapp" ? "active" : ""} onClick={() => setView("whatsapp")}>WhatsApp parents</button>
          </div>
          <span className="spacer" />
          {view === "award" && (
            <>
              <select style={{ width: 110 }} value={size} onChange={(e) => setSize(e.target.value as "A4" | "LEGAL")}><option value="A4">A4</option><option value="LEGAL">Legal</option></select>
              <select style={{ width: 140 }} value={sortBy} onChange={(e) => setSortBy(e.target.value as "roll" | "position")}><option value="roll">Sort by roll no</option><option value="position">Sort by position</option></select>
            </>
          )}
          {view !== "whatsapp" && <button onClick={() => window.print()} disabled={!rows.length}>🖨️ Print</button>}
        </div>
        <div className="row small" style={{ marginTop: 8, gap: 16 }}>
          <span>Students: <b>{sum.total}</b></span><span>Present: <b>{sum.present}</b></span><span>Passed: <b className="ok">{sum.passed}</b></span>
          <span>Failed: <b>{sum.failed}</b></span><span>Pass rate: <b>{sum.passRate}%</b></span><span>Class average: <b>{sum.average}%</b></span><span>Highest: <b>{sum.highest}/{totalMarks}</b></span>
        </div>
      </div>

      {view === "award" && (
        <div className="paper-stage">
          <div className="sheet award" style={{ width: size === "A4" ? "210mm" : "216mm", padding: "8mm", backgroundImage: "none" }}>
            <Heading paper={paper} />
            {toppers.length > 0 && (
              <div style={{ display: "flex", gap: "4mm", justifyContent: "center", marginBottom: "3mm", fontSize: "10pt" }}>
                {toppers.map((t) => <span key={t.rollNo}><b>{ordinal(t.position)}:</b> {t.studentName || `Roll ${t.rollNo}`} ({t.obtained})</span>)}
              </div>
            )}
            <table>
              <thead>
                <tr>
                  <th>Sr.</th><th>Roll No</th><th>Student Name</th><th>Father Name</th>
                  {hasParts && <><th>MCQ</th><th>Subj.</th></>}
                  <th>Obtained / {totalMarks}</th><th>%</th><th>Grade</th><th>Status</th><th>Position</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r, i) => (
                  <tr key={r.rollNo + i}>
                    <td>{i + 1}</td><td>{r.rollNo}</td><td>{r.studentName}</td><td>{r.fatherName}</td>
                    {hasParts && <><td>{r.absent ? "" : r.mcqObtained ?? ""}</td><td>{r.absent ? "" : r.subjectiveObtained ?? ""}</td></>}
                    <td><b>{r.absent ? "A" : r.obtained}</b></td><td>{r.absent ? "" : r.percentage}</td><td>{r.grade}</td>
                    <td>{r.absent ? "Absent" : r.passed ? "Pass" : "Fail"}</td><td>{ordinal(r.position)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8mm", fontSize: "10pt" }}>
              <span>Passed {sum.passed}/{sum.present} ({sum.passRate}%) • Pass marks {passPercent}% • Average {sum.average}%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "14mm", fontSize: "10pt" }}>
              <span>Subject Teacher: ____________</span><span>Class Incharge: ____________</span><span>Principal: ____________</span>
            </div>
          </div>
        </div>
      )}

      {view === "slips" && (
        <div className="paper-stage">
          <div className="sheet" style={{ width: "210mm", padding: "6mm", backgroundImage: "none" }}>
            {pages.map((pg, pi) => (
              <div key={pi} className={`slips ${pi < pages.length - 1 ? "slips-page" : ""}`}>
                {pg.map((r) => (
                  <div className="slip" key={r.rollNo}>
                    <h4>{paper.institution.name}</h4>
                    <div style={{ textAlign: "center", fontWeight: 700 }}>{paper.title}</div>
                    <div style={{ textAlign: "center", fontSize: "9pt" }}>{[paper.className, paper.subjectName].filter(Boolean).join(" • ")}</div>
                    <table>
                      <tbody>
                        <tr><td>Student</td><td><b>{r.studentName}</b></td></tr>
                        {r.fatherName && <tr><td>Father</td><td>{r.fatherName}</td></tr>}
                        <tr><td>Roll No</td><td>{r.rollNo}</td></tr>
                        {r.mcqObtained != null && <tr><td>Objective (MCQ)</td><td>{r.mcqObtained}</td></tr>}
                        {r.subjectiveObtained != null && <tr><td>Subjective</td><td>{r.subjectiveObtained}</td></tr>}
                        <tr><td>Marks</td><td><b>{r.absent ? "Absent" : `${r.obtained} / ${totalMarks}`}</b></td></tr>
                        {!r.absent && <tr><td>Percentage</td><td>{r.percentage}%</td></tr>}
                        <tr><td>Grade</td><td><b>{r.grade}</b></td></tr>
                        <tr><td>Result</td><td>{r.absent ? "—" : r.passed ? "PASS" : "FAIL"}</td></tr>
                        <tr><td>Class position</td><td>{ordinal(r.position)} of {sum.present}</td></tr>
                      </tbody>
                    </table>
                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8mm", fontSize: "9pt" }}><span>Teacher ________</span><span>Parent ________</span></div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {view === "whatsapp" && (
        <div className="card no-print">
          <p className="small muted">Free: each button opens WhatsApp (app or web) with the message ready — just press send. Add parent numbers in the marks grid (03xx-xxxxxxx).</p>
          <table className="tbl">
            <thead><tr><th>Roll</th><th>Student</th><th>Phone</th><th>Marks</th><th /></tr></thead>
            <tbody>
              {sorted.map((r) => {
                const link = whatsappLink(r.parentPhone, slipMessage(paper, r, totalMarks));
                return (
                  <tr key={r.rollNo}>
                    <td>{r.rollNo}</td><td>{r.studentName}</td><td>{r.parentPhone ?? <span className="muted">—</span>}</td>
                    <td>{r.absent ? "Absent" : `${r.obtained}/${totalMarks} · ${r.grade}`}</td>
                    <td>{link ? <a className="btn btn-sm" href={link} target="_blank" rel="noreferrer">Send on WhatsApp</a> : <span className="small muted">no valid number</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
