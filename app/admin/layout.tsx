import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import { getSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const s = await getSession();
  if (s?.user.role !== "SUPER_ADMIN") redirect("/dashboard");
  return (
    <>
      <Nav isSuper userId={s?.user.id} />
      <main className="container">{children}</main>
    </>
  );
}
