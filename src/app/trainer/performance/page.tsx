import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Star } from "lucide-react";

export default async function TrainerPerformancePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: trainer } = await supabase
    .from("trainers")
    .select("id, max_clients_per_slot")
    .eq("user_id", user.id)
    .single();

  if (!trainer) {
    return (
      <div className="px-8 py-16 text-center text-[#6B6E67]">Trainer profile not found.</div>
    );
  }

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const monthLabel = now.toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "Asia/Kolkata" });

  const [
    { data: sessionsRaw },
    { data: feedbackRaw },
    { data: assignmentsRaw },
    { data: allSessionsRaw },
  ] = await Promise.all([
    supabase.from("pt_sessions").select("status, session_date").eq("trainer_id", trainer.id).gte("session_date", monthStart).lte("session_date", monthEnd),
    supabase.from("trainer_feedback").select("overall_rating, is_punctual, satisfied_with_progress, would_continue, written_feedback, created_at").eq("trainer_id", trainer.id).order("created_at", { ascending: false }),
    supabase.from("pt_assignments").select("id").eq("trainer_id", trainer.id).eq("status", "active"),
    supabase.from("pt_sessions").select("status").eq("trainer_id", trainer.id),
  ]);

  const sessions = sessionsRaw ?? [];
  const feedback = feedbackRaw ?? [];
  const assignments = assignmentsRaw ?? [];
  const allSessions = allSessionsRaw ?? [];

  const completedMonth = sessions.filter((s: any) => s.status === "completed").length;
  const cancelledMonth = sessions.filter((s: any) => s.status === "cancelled").length;
  const noShowMonth = sessions.filter((s: any) => s.status === "no_show").length;
  const scheduledMonth = sessions.filter((s: any) => s.status === "scheduled").length;
  const totalMonth = sessions.length;

  const completedAll = allSessions.filter((s: any) => s.status === "completed").length;
  const totalAll = allSessions.length;
  const completionRate = totalAll > 0 ? Math.round((completedAll / totalAll) * 100) : 0;

  const avgRating = feedback.length > 0
    ? (feedback.reduce((s: number, f: any) => s + (f.overall_rating ?? 0), 0) / feedback.length).toFixed(1)
    : null;
  const punctualPct = feedback.length > 0 ? Math.round((feedback.filter((f: any) => f.is_punctual === true).length / feedback.length) * 100) : null;
  const progressPct = feedback.length > 0 ? Math.round((feedback.filter((f: any) => f.satisfied_with_progress === true).length / feedback.length) * 100) : null;
  const continuePct = feedback.length > 0 ? Math.round((feedback.filter((f: any) => f.would_continue === true).length / feedback.length) * 100) : null;

  const activeClients = assignments.length;
  const utilizationPct = trainer.max_clients_per_slot > 0
    ? Math.min(100, Math.round((activeClients / (trainer.max_clients_per_slot * 2)) * 100))
    : null;

  const stats = [
    { label: "Sessions This Month", value: totalMonth, sub: `${scheduledMonth} upcoming` },
    { label: "Completed", value: completedMonth, sub: totalMonth > 0 ? `${Math.round((completedMonth / totalMonth) * 100)}%` : "—" },
    { label: "Cancelled", value: cancelledMonth, sub: "this month" },
    { label: "No-shows", value: noShowMonth, sub: "this month" },
    { label: "Active Clients", value: activeClients, sub: `max ${trainer.max_clients_per_slot}/slot` },
    { label: "Overall Completion", value: `${completionRate}%`, sub: `${completedAll}/${totalAll} all-time` },
  ];

  return (
    <div>
      <Header title="My Performance" subtitle={monthLabel} />
      <div className="px-8 py-6 space-y-5">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {stats.map(s => (
            <div key={s.label} className="bg-[#222520] border border-[#2E3129] rounded-2xl p-4">
              <div className="text-[10px] text-[#6B6E67] font-medium mb-1.5">{s.label}</div>
              <div className="text-2xl font-bold text-[#E8EBE4] tabular-nums tracking-tight">{s.value}</div>
              <div className="text-[10px] text-[#6B6E67] mt-0.5">{s.sub}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[#E8EBE4] mb-4">Client Satisfaction</h3>
            {feedback.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="text-3xl font-bold text-[#E8EBE4] tabular-nums">{avgRating}</div>
                  <div>
                    <div className="flex gap-0.5 mb-1">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={13} className={n <= Math.round(Number(avgRating)) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"} />
                      ))}
                    </div>
                    <div className="text-xs text-[#6B6E67]">{feedback.length} responses</div>
                  </div>
                </div>
                {[
                  { label: "Clients find me punctual", pct: punctualPct },
                  { label: "Clients see progress", pct: progressPct },
                  { label: "Would continue training", pct: continuePct },
                ].map(row => row.pct !== null && (
                  <div key={row.label}>
                    <div className="flex justify-between text-xs text-[#6B6E67] mb-1">
                      <span>{row.label}</span>
                      <span className="font-medium text-[#E8EBE4]">{row.pct}%</span>
                    </div>
                    <div className="h-1.5 bg-[#1A1C18] rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${(row.pct ?? 0) >= 80 ? "bg-[#B9E84A]" : (row.pct ?? 0) >= 60 ? "bg-amber-400" : "bg-red-400"}`} style={{ width: `${row.pct}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-[#6B6E67]">No feedback received yet.</p>
            )}
          </div>

          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-[#E8EBE4] mb-4">This Month&apos;s Sessions</h3>
            <div className="space-y-3">
              {[
                { label: "Completed", count: completedMonth, bg: "bg-[#B9E84A]" },
                { label: "Scheduled", count: scheduledMonth, bg: "bg-blue-300" },
                { label: "Cancelled", count: cancelledMonth, bg: "bg-amber-300" },
                { label: "No-show", count: noShowMonth, bg: "bg-red-300" },
              ].map(row => (
                <div key={row.label}>
                  <div className="flex justify-between text-xs text-[#6B6E67] mb-1">
                    <span>{row.label}</span>
                    <span className="font-medium text-[#E8EBE4] tabular-nums">{row.count}</span>
                  </div>
                  <div className="h-1.5 bg-[#1A1C18] rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${row.bg}`} style={{ width: totalMonth > 0 ? `${(row.count / totalMonth) * 100}%` : "0%" }} />
                  </div>
                </div>
              ))}
            </div>
            {utilizationPct !== null && (
              <div className="mt-4 pt-4 border-t border-[#1A1C18]">
                <div className="flex justify-between text-xs text-[#6B6E67] mb-1">
                  <span>Capacity utilization</span>
                  <span className="font-medium text-[#E8EBE4]">{utilizationPct}%</span>
                </div>
                <div className="h-1.5 bg-[#1A1C18] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#B9E84A]" style={{ width: `${utilizationPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        {feedback.length > 0 && (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129]">
              <h3 className="text-sm font-semibold text-[#E8EBE4]">Recent Client Feedback</h3>
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {feedback.slice(0, 5).map((f: any, i: number) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center gap-1 mb-1.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={11} className={n <= (f.overall_rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"} />
                    ))}
                    <span className="text-[10px] text-[#6B6E67] ml-2">
                      {new Date(f.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                    </span>
                  </div>
                  <div className="flex gap-3 text-[10px] text-[#6B6E67] mb-1.5">
                    {f.is_punctual !== null && <span>{f.is_punctual ? "✓ Punctual" : "✗ Not punctual"}</span>}
                    {f.satisfied_with_progress !== null && <span>{f.satisfied_with_progress ? "✓ Progress" : "✗ No progress"}</span>}
                    {f.would_continue !== null && <span>{f.would_continue ? "✓ Would continue" : "✗ Would not continue"}</span>}
                  </div>
                  {f.written_feedback && (
                    <p className="text-xs text-[#6B6E67] italic">&quot;{f.written_feedback}&quot;</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
