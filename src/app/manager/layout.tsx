import { redirect } from "next/navigation";
import { getProfile, getGymData } from "@/lib/supabase/server";
import { ManagerShell } from "@/components/layout/manager-shell";

export default async function ManagerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  if (profile.role !== "gym_manager") redirect("/trainer");

  const gym = await getGymData(profile.gymId);

  return (
    <ManagerShell
      gymName={gym?.name ?? ""}
      gymBranch={gym?.branch_name ?? undefined}
      userFirstName={profile.firstName}
      userLastName={profile.lastName}
    >
      {children}
    </ManagerShell>
  );
}
