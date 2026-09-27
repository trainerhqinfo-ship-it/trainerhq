import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { TrainerForm } from "@/components/forms/trainer-form";

export default async function EditTrainerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const { data: trainer } = await supabase.from("trainers")
    .select("*").eq("id", id).eq("gym_id", gymId).single();

  if (!trainer) notFound();

  return (
    <div>
      <Header title="Edit Trainer" subtitle={`${trainer.first_name} ${trainer.last_name}`} />
      <div className="px-8 py-6 max-w-4xl">
        <TrainerForm trainer={trainer} />
      </div>
    </div>
  );
}
