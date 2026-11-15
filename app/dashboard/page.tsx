import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getPlanState } from "@/lib/plan";
import { PAPER_TYPE_LABEL } from "@/lib/types";
import DeletePaperButton from "@/components/DeletePaperButton";

export default async function Dashboard() {
  const s = await getSession();
  if (!s?.user.institutionId) redirect("/login");
  const iid = s.user.institutionId;
  const [plan, papers, qCount, sessions] = await Promise.all([
    getPlanState(iid),
    prisma.savedPaper.findMany({
      where: { institutionId: iid },
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { class: true, subject: true, resultSessions: { select: { id: true, status: true }, take: 1, orderBy: { createdAt: "desc" } } },
    }),
    prisma.question.count({ where: { chapter: { subject: { class: { institutionId: iid } } } } }),
    prisma.paperResultSession.count({ where: { institutionId: iid } }),
  ]);

  return (
    <div>
      <div className="row" style={{ marginBottom: 14 }}>
        <h1 style={{ margin: 0 }}>{plan.inst.name}</h1>
        <span className="spacer" />
        <Link className="btn" href="/dashboard/papers/new">+ New Paper</Link>
      </div>

      {!plan.isPro && (
        <div className={`alert ${plan.remaining > 0 ? "" : "err"}`}>
          Free trial: <b>{plan.used} / {plan.limit}</b> papers used.{" "}
          {plan.remaining > 0 ? `${plan.remaining} left.` : "Trial finished."} <Link href="/dashboard/billing">Upgrade to PaperMaker Pro →</Link>
        </div>
      )}

      <div className="grid3" style={{ marginBottom: 14 }}>
        <div className="card"><div className="muted small">Saved papers</div><div className="stat">{papers.length}</div></div>
        <div className="card" style={{ marginTop: 0 }}><div className="muted small">Questions in bank</div><div className="stat">{qCount}</div><Link className="small" href="/dashboard/questions">Manage →</Link></div>
        <div className="card" style={{ marginTop: 0 }}><div className="muted small">Class results made</div><div className="stat">{sessions}</div></div>
      </div>

      <div className="card">
        <h2>Papers</h2>
        {papers.length === 0 ? (
          <p className="muted">No papers yet. Add some questions to the <Link href="/dashboard/questions">question bank</Link>, then create your first paper.</p>
        ) : (
          <table className="tbl">
            <thead><tr><th>Title</th><th>Class / Subject</th><th>Type</th><th>Marks</th><th>Created</th><th /></tr></thead>
            <tbody>
              {papers.map((p) => (
                <tr key={p.id}>
                  <td><Link href={`/dashboard/papers/${p.id}`}><b>{p.title}</b></Link> {p.watermark && <span className="badge warn">trial</span>}</td>
                  <td>{p.class?.name ?? "—"} / {p.subject?.name ?? "—"}</td>
                  <td>{PAPER_TYPE_LABEL[p.paperType]}</td>
                  <td>{p.totalMarks}</td>
                  <td>{p.createdAt.toLocaleDateString("en-GB")}</td>
                  <td>
                    <div className="row" style={{ gap: 6 }}>
                      <Link className="btn btn-sm" href={`/dashboard/papers/${p.id}`}>Print</Link>
                      {p.resultSessions[0] && (
                        <Link className="btn btn-sm btn-ghost" href={`/dashboard/papers/${p.id}/result?session=${p.resultSessions[0].id}`}>
                          Result {p.resultSessions[0].status === "FINAL" ? "✔" : "(draft)"}
                        </Link>
                      )}
                      <DeletePaperButton id={p.id} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
