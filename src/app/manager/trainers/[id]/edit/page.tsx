import { notFound, redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { TrainerForm } from "@/components/forms/trainer-form";

export default async function EditTrainerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();

  const [{ data: trainer }, { data: workingHoursRaw }] = await Promise.all([
    supabase.from("trainers").select("*").eq("id", id).eq("gym_id", gymId).single(),
    supabase.from("trainer_working_hours").select("*").eq("trainer_id", id).order("day_of_week"),
  ]);

  if (!trainer) notFound();

  return (
    <div>
      <Header title="Edit Trainer" subtitle={`${trainer.first_name} ${trainer.last_name}`} />
      <div className="px-8 py-6 max-w-4xl">
        <TrainerForm trainer={trainer} initialWorkingHours={workingHoursRaw ?? undefined} />
      </div>
    </div>
  );
}
