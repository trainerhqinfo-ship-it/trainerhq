import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { UserPlus } from "lucide-react";
import { TrainersTable } from "./trainers-table";

export default async function ManagerTrainersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const [{ data: trainersRaw }, { data: assignmentsRaw }, { data: feedbackRaw }] = await Promise.all([
    supabase
      .from("trainers")
      .select("id, first_name, last_name, role_title, specializations, joining_date, max_clients_per_slot, status, profile_picture_url")
      .eq("gym_id", gymId)
      .order("first_name"),
    supabase
      .from("pt_assignments")
      .select("trainer_id")
      .eq("gym_id", gymId)
      .eq("status", "active"),
    supabase
      .from("trainer_feedback")
      .select("trainer_id, overall_rating")
      .eq("gym_id", gymId),
  ]);

  const trainers = trainersRaw ?? [];
  const activeCount = trainers.filter(t => t.status === "active").length;

  return (
    <div>
      <Header
        title="Trainers"
        subtitle={`${activeCount} active trainers`}
        actions={
          <a
            href="/manager/trainers/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#B9E84A] text-[#171917] text-xs font-semibold hover:bg-[#A8D63A] transition-colors"
          >
            <UserPlus size={13} />
            Add Trainer
          </a>
        }
      />
      <div className="px-8 py-6">
        <TrainersTable
          trainers={trainers as any}
          assignments={assignmentsRaw ?? []}
          feedback={feedbackRaw ?? []}
        />
      </div>
    </div>
  );
}
