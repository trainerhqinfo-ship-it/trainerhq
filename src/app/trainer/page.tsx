import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatTime } from "@/lib/utils";
import { Star, Calendar, Users, CheckSquare } from "lucide-react";

export default async function TrainerDashboard() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: trainerData } = await supabase
    .from("trainers")
    .select("*")
    .eq("user_id", user.id)
    .single();

  if (!trainerData) {
    return (
      <div className="px-8 py-16 text-center">
        <p className="text-[#6B6E67]">Trainer profile not found. Contact your manager.</p>
      </div>
    );
  }

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [
    { data: todaySessionsRaw },
    { data: assignmentsRaw },
    { data: feedback },
  ] = await Promise.all([
    supabase.from("pt_sessions")
      .select("*, pt_clients(first_name, last_name)")
      .eq("trainer_id", trainerData.id)
      .eq("session_date", today)
      .order("start_time"),
    supabase.from("pt_assignments")
      .select("*, pt_clients(first_name, last_name, goal)")
      .eq("trainer_id", trainerData.id)
      .eq("status", "active"),
    supabase.from("trainer_feedback")
      .select("overall_rating")
      .eq("trainer_id", trainerData.id),
  ]);

  const todaySessions = todaySessionsRaw ?? [];
  const assignments = assignmentsRaw ?? [];

  const avgRating = feedback && feedback.length > 0
    ? (feedback.reduce((s: number, f: any) => s + (f.overall_rating ?? 0), 0) / feedback.length).toFixed(1)
    : null;

  const subtitle = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div>
      <Header title="My Dashboard" subtitle={subtitle} />

      <div className="px-4 md:px-8 py-6 space-y-5">
        {/* Trainer summary */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
          <div className="flex items-center gap-4">
            <Avatar firstName={trainerData.first_name} lastName={trainerData.last_name} size="lg" />
            <div>
              <h2 className="text-base font-semibold text-[#E8EBE4]">{trainerData.first_name} {trainerData.last_name}</h2>
              <p className="text-sm text-[#6B6E67]">{trainerData.role_title}</p>
              <div className="mt-2 flex gap-2">
                <StatusBadge status={trainerData.status} />
                <span className="text-xs text-[#6B6E67]">Max {trainerData.max_clients_per_slot} clients/slot</span>
              </div>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Today's Sessions", value: todaySessions.length, icon: <Calendar size={15} /> },
            { label: "Active Clients", value: assignments.length, icon: <Users size={15} /> },
            { label: "Completed Today", value: todaySessions.filter((s: any) => s.status === "completed").length, icon: <CheckSquare size={15} /> },
            { label: "My Rating", value: avgRating ? `${avgRating}/5` : "—", icon: <Star size={15} /> },
          ].map(s => (
            <div key={s.label} className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
              <div className="w-7 h-7 rounded-lg bg-[#E8EBE4] flex items-center justify-center text-[#B9E84A] mb-3">
                {s.icon}
              </div>
              <div className="text-2xl font-bold text-[#E8EBE4] tabular-nums">{s.value}</div>
              <div className="text-xs text-[#6B6E67] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Today's sessions */}
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129]">
              <h3 className="text-sm font-semibold text-[#E8EBE4]">Today&apos;s Sessions</h3>
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {todaySessions.map((session: any) => {
                const client = session.pt_clients;
                return (
                  <div key={session.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="text-xs text-[#6B6E67] w-14 tabular-nums flex-shrink-0">
                      {formatTime(session.start_time)}
                    </div>
                    <Avatar firstName={client?.first_name ?? "?"} lastName={client?.last_name ?? ""} size="xs" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-[#E8EBE4]">{client?.first_name} {client?.last_name}</div>
                    </div>
                    <StatusBadge status={session.status} />
                  </div>
                );
              })}
              {!todaySessions.length && (
                <div className="px-5 py-8 text-center text-sm text-[#6B6E67]">No sessions today</div>
              )}
            </div>
          </div>

          {/* Active clients */}
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129]">
              <h3 className="text-sm font-semibold text-[#E8EBE4]">My PT Clients</h3>
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {assignments.map((a: any) => {
                const client = a.pt_clients;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar firstName={client?.first_name ?? "?"} lastName={client?.last_name ?? ""} size="xs" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#E8EBE4] truncate">{client?.first_name} {client?.last_name}</div>
                      <div className="text-xs text-[#6B6E67]">{client?.goal}</div>
                    </div>
                    <div className="text-xs text-[#6B6E67]">
                      {formatTime(a.preferred_time)}
                    </div>
                  </div>
                );
              })}
              {!assignments.length && (
                <div className="px-5 py-8 text-center text-sm text-[#6B6E67]">No clients assigned</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
