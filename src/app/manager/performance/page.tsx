import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { Star, TrendingUp, Zap } from "lucide-react";

export default async function PerformancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const [
    { data: trainers },
    { data: sessions },
    { data: assignments },
    { data: feedback },
    { data: payouts },
  ] = await Promise.all([
    supabase.from("trainers").select("*").eq("gym_id", gymId).eq("status", "active"),
    supabase.from("pt_sessions").select("trainer_id, status, session_revenue").eq("gym_id", gymId),
    supabase.from("pt_assignments").select("trainer_id").eq("gym_id", gymId).eq("status", "active"),
    supabase.from("trainer_feedback").select("trainer_id, overall_rating").eq("gym_id", gymId),
    supabase.from("trainer_payouts").select("*").eq("gym_id", gymId).eq("period_month", month).eq("period_year", year),
  ]);

  const stats = (trainers ?? []).map((trainer: any) => {
    const trainerSessions = (sessions ?? []).filter((s: any) => s.trainer_id === trainer.id);
    const completed = trainerSessions.filter((s: any) => s.status === "completed").length;
    const cancelled = trainerSessions.filter((s: any) => s.status === "cancelled").length;
    const noShow = trainerSessions.filter((s: any) => s.status === "no_show").length;
    const scheduled = trainerSessions.filter((s: any) => s.status === "scheduled").length;
    const revenue = trainerSessions.filter((s: any) => s.status === "completed")
      .reduce((s: number, x: any) => s + (x.session_revenue ?? 0), 0);
    const activeClients = (assignments ?? []).filter((a: any) => a.trainer_id === trainer.id).length;
    const maxCapacity = trainer.max_clients_per_slot;
    const trainerFeedback = (feedback ?? []).filter((f: any) => f.trainer_id === trainer.id);
    const avgRating = trainerFeedback.length > 0
      ? trainerFeedback.reduce((s: number, f: any) => s + (f.overall_rating ?? 0), 0) / trainerFeedback.length
      : null;
    const payout = (payouts ?? []).find((p: any) => p.trainer_id === trainer.id);
    const utilization = (completed + scheduled) > 0
      ? Math.round((completed / (completed + scheduled + cancelled + noShow)) * 100)
      : 0;
    return { trainer, completed, cancelled, noShow, scheduled, revenue, activeClients, maxCapacity, avgRating, payout, utilization };
  });

  return (
    <div>
      <Header title="Trainer Performance" subtitle="Measurable metrics — no AI scores" />

      <div className="px-8 py-6 space-y-5">
        {stats.map(({ trainer, completed, cancelled, noShow, scheduled, revenue, activeClients, maxCapacity, avgRating, payout, utilization }: any) => (
          <div key={trainer.id} className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-3">
                <Avatar firstName={trainer.first_name} lastName={trainer.last_name} src={trainer.profile_picture_url} size="md" />
                <div>
                  <h3 className="text-sm font-semibold text-[#E8EBE4]">{trainer.first_name} {trainer.last_name}</h3>
                  <p className="text-xs text-[#6B6E67]">{trainer.role_title}</p>
                </div>
              </div>
              <StatusBadge status={trainer.status} />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {[
                { label: "Utilization", value: `${utilization}%`, accent: utilization >= 80, icon: <Zap size={12} /> },
                { label: "Scheduled", value: completed + scheduled, accent: false, icon: null },
                { label: "Completed", value: completed, accent: false, icon: null },
                { label: "Cancelled", value: cancelled, accent: false, icon: null },
                { label: "No-shows", value: noShow, accent: false, icon: null },
                { label: "Active Clients", value: `${activeClients}/${maxCapacity}/slot`, accent: false, icon: null },
                { label: "Rating", value: avgRating ? `${avgRating.toFixed(1)}/5` : "—", accent: (avgRating ?? 0) >= 4.5, icon: <Star size={12} /> },
                { label: "Month Payout", value: payout ? formatCurrency(payout.final_payout) : "—", accent: false, icon: <TrendingUp size={12} /> },
              ].map((metric, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3 ${metric.accent ? "bg-[#B9E84A]/10 border border-[#B9E84A]/30" : "bg-[#1A1C18]"}`}
                >
                  <div className={`text-xs mb-1 flex items-center gap-1 ${metric.accent ? "text-[#B9E84A]" : "text-[#6B6E67]"}`}>
                    {metric.icon}
                    {metric.label}
                  </div>
                  <div className={`text-base font-bold tabular-nums ${metric.accent ? "text-[#3D6005]" : "text-[#E8EBE4]"}`}>
                    {metric.value}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4">
              <div className="flex justify-between text-xs text-[#6B6E67] mb-1">
                <span>Session completion rate</span>
                <span>{utilization}%</span>
              </div>
              <div className="h-1.5 bg-[#222520] rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${utilization >= 80 ? "bg-[#B9E84A]" : utilization >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                  style={{ width: `${utilization}%` }}
                />
              </div>
            </div>
          </div>
        ))}

        {!stats.length && (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl py-16 text-center text-sm text-[#6B6E67]">
            No active trainers
          </div>
        )}
      </div>
    </div>
  );
}
