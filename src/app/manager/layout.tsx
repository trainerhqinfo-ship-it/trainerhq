import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/supabase/server";
import { ManagerShell } from "@/components/layout/manager-shell";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Only check that a session exists (no DB query — avoids ~54s server→Supabase latency)
  const user = await getSessionUser();
  if (!user) redirect("/login");

  return <ManagerShell userId={user.id}>{children}</ManagerShell>;
}
