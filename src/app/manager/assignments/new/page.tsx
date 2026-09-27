import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { AssignmentForm } from "@/components/forms/assignment-form";

export default async function NewAssignmentPage({
  searchParams,
}: {
  searchParams: Promise<{ client?: string }>;
}) {
  const { client: preselectedClientId } = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const [{ data: trainersData }, { data: clientsData }] = await Promise.all([
    supabase.from("trainers")
      .select("*, trainer_working_hours(*), pt_assignments(trainer_id, preferred_time, days_of_week, status)")
      .eq("gym_id", gymId)
      .eq("status", "active"),
    supabase.from("pt_clients").select("*").eq("gym_id", gymId).eq("status", "active"),
  ]);

  return (
    <div>
      <Header title="New Assignment" subtitle="Assign a PT client to a trainer" />
      <div className="px-8 py-6 max-w-2xl">
        <AssignmentForm
          trainers={trainersData ?? []}
          clients={clientsData ?? []}
          preselectedClientId={preselectedClientId}
        />
      </div>
    </div>
  );
}
