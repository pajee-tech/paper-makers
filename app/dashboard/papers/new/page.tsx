import { redirect } from "next/navigation";
import PaperBuilder from "@/components/PaperBuilder";
import UpgradePrompt from "@/components/UpgradePrompt";
import { getSession } from "@/lib/auth";
import { getPlanState } from "@/lib/plan";

export default async function NewPaperPage() {
  const s = await getSession();
  if (!s?.user.institutionId) redirect("/login");
  const plan = await getPlanState(s.user.institutionId);
  // Server-side trial guard: blocked trials see the upgrade prompt instead of the builder.
  if (!plan.isPro && (plan.trialExpired || plan.remaining <= 0)) {
    return (
      <div>
        <h1>New Paper</h1>
        <UpgradePrompt
          message={plan.trialExpired ? "Your free trial period has ended." : `You have used all ${plan.limit} free papers.`}
          used={plan.used}
          limit={plan.limit}
          daysLeft={plan.daysLeft}
        />
      </div>
    );
  }
  return (
    <div>
      <h1>New Paper</h1>
      {!plan.isPro && (
        <div className="alert">
          Free trial: <b>{plan.used} / {plan.limit}</b> papers generated{plan.daysLeft != null ? <> · <b>{plan.daysLeft}</b> day{plan.daysLeft === 1 ? "" : "s"} left</> : null}. <a href="/dashboard/billing">Upgrade to Pro</a>
        </div>
      )}
      <PaperBuilder />
    </div>
  );
}
