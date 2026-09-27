import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { SessionsTable } from "./sessions-table";

export default async function TrainerSessionsPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: trainer } = await supabase
    .from("trainers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!trainer) {
    return (
      <div className="px-8 py-16 text-center text-[#6B6E67]">Trainer profile not found.</div>
    );
  }

  const { data: sessionsRaw } = await supabase
    .from("pt_sessions")
    .select("*, pt_clients(first_name, last_name)")
    .eq("trainer_id", trainer.id)
    .order("session_date", { ascending: false })
    .limit(50);

  const sessions = sessionsRaw ?? [];

  return (
    <div>
      <Header title="My Sessions" subtitle={`${sessions.length} sessions`} />
      <div className="px-4 md:px-8 py-6">
        <SessionsTable sessions={sessions} trainerId={trainer.id} />
      </div>
    </div>
  );
}
