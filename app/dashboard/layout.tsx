import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getSession } from "@/lib/auth";
import { getPlanState } from "@/lib/plan";

export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (!s?.user) redirect("/login");
  const plan = s.user.institutionId ? (await getPlanState(s.user.institutionId)).plan : undefined;
  return (
    <>
      <Nav isSuper={s.user.role === "SUPER_ADMIN"} plan={plan} userId={s.user.id} />
      <main className="container">{children}</main>
    </>
  );
}
