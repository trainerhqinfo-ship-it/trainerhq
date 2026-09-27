import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { TrainerClientsTable } from "./trainer-clients-table";

export default async function TrainerClientsPage() {
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

  const { data: assignments } = await supabase
    .from("pt_assignments")
    .select("*, pt_clients(id, first_name, last_name, goal, total_sessions, profile_picture_url, phone)")
    .eq("trainer_id", trainer.id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const clientIds = (assignments ?? []).map((a: any) => a.client_id).filter(Boolean);

  let enriched: any[] = [];
  if (clientIds.length > 0) {
    const [{ data: completedSessions }, { data: nextSessions }] = await Promise.all([
      supabase.from("pt_sessions").select("client_id").eq("trainer_id", trainer.id).eq("status", "completed").in("client_id", clientIds),
      supabase.from("pt_sessions").select("client_id, session_date, start_time").eq("trainer_id", trainer.id).eq("status", "scheduled").gte("session_date", today).order("session_date").order("start_time"),
    ]);

    const completedCounts = (completedSessions ?? []).reduce((acc: any, s: any) => {
      acc[s.client_id] = (acc[s.client_id] ?? 0) + 1;
      return acc;
    }, {});

    const nextByClient: Record<string, any> = {};
    (nextSessions ?? []).forEach((s: any) => {
      if (!nextByClient[s.client_id]) nextByClient[s.client_id] = s;
    });

    enriched = (assignments ?? []).map((a: any) => ({
      ...a,
      completedCount: completedCounts[a.client_id] ?? 0,
      nextSession: nextByClient[a.client_id] ?? null,
    }));
  }

  return (
    <div>
      <Header
        title="My Clients"
        subtitle={`${enriched.length} active client${enriched.length !== 1 ? "s" : ""}`}
      />
      <div className="px-4 md:px-8 py-5">
        <TrainerClientsTable clients={enriched} today={today} />
      </div>
    </div>
  );
}
