import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatDate, formatTime, DAY_NAMES_FULL } from "@/lib/utils";
import { Star } from "lucide-react";

export default async function TrainerClientDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: trainer } = await supabase
    .from("trainers")
    .select("id")
    .eq("user_id", user.id)
    .single();

  if (!trainer) redirect("/login");

  const { data: assignmentRaw } = await supabase
    .from("pt_assignments")
    .select("*, pt_clients(*)")
    .eq("trainer_id", trainer.id)
    .eq("client_id", id)
    .eq("status", "active")
    .single() as any;

  if (!assignmentRaw) notFound();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [
    { data: sessionsRaw },
    { data: feedbackRaw },
    { data: nextRaw },
  ] = await Promise.all([
    supabase.from("pt_sessions")
      .select("*")
      .eq("trainer_id", trainer.id)
      .eq("client_id", id)
      .order("session_date", { ascending: false })
      .limit(30),
    supabase.from("trainer_feedback")
      .select("*")
      .eq("trainer_id", trainer.id)
      .eq("client_id", id)
      .order("created_at", { ascending: false }),
    supabase.from("pt_sessions")
      .select("*")
      .eq("trainer_id", trainer.id)
      .eq("client_id", id)
      .eq("status", "scheduled")
      .gte("session_date", today)
      .order("session_date")
      .order("start_time")
      .limit(1)
      .maybeSingle(),
  ]);

  const assignment = assignmentRaw;
  const sessions = sessionsRaw ?? [];
  const feedback = feedbackRaw ?? [];
  const nextSession = nextRaw;

  const client = assignment.pt_clients;
  const completedCount = sessions.filter((s: any) => s.status === "completed").length;
  const totalSessions = assignment.total_sessions ?? 0;
  const remaining = Math.max(0, totalSessions - completedCount);
  const progressPct = totalSessions > 0 ? Math.round((completedCount / totalSessions) * 100) : 0;
  const avgRating = feedback.length > 0
    ? (feedback.reduce((s: number, f: any) => s + (f.overall_rating ?? 0), 0) / feedback.length).toFixed(1)
    : null;

  return (
    <div>
      <Header title={`${client?.first_name} ${client?.last_name}`} subtitle="Client Profile" />
      <div className="px-8 py-6 space-y-5 max-w-4xl">
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6">
          <div className="flex items-start gap-4">
            <Avatar firstName={client?.first_name ?? "?"} lastName={client?.last_name ?? ""} size="xl" />
            <div className="flex-1">
              <h2 className="text-base font-semibold text-[#E8EBE4]">{client?.first_name} {client?.last_name}</h2>
              <p className="text-sm text-[#9B9E96] mt-0.5">{client?.goal}</p>
              <div className="mt-2 flex gap-2 flex-wrap">
                <StatusBadge status={client?.status} />
                {client?.phone && <span className="text-xs text-[#9B9E96]">{client?.phone}</span>}
              </div>
            </div>
          </div>
          <div className="mt-5 pt-5 border-t border-[#1A1C18]">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <div className="text-xs text-[#9B9E96] mb-1">Package</div>
                <div className="text-sm font-semibold text-[#E8EBE4]">{totalSessions} Sessions</div>
              </div>
              <div>
                <div className="text-xs text-[#9B9E96] mb-1">Completed</div>
                <div className="text-sm font-bold text-[#E8EBE4] tabular-nums">{completedCount}</div>
              </div>
              <div>
                <div className="text-xs text-[#9B9E96] mb-1">Remaining</div>
                <div className={`text-sm font-bold tabular-nums ${remaining <= 3 ? "text-amber-400" : "text-[#E8EBE4]"}`}>{remaining}</div>
              </div>
              <div>
                <div className="text-xs text-[#9B9E96] mb-1">Next Session</div>
                <div className="text-sm font-medium text-[#E8EBE4]">
                  {nextSession ? `${formatDate(nextSession.session_date)} · ${formatTime(nextSession.start_time)}` : "—"}
                </div>
              </div>
            </div>
            {totalSessions > 0 && (
              <div className="mt-4">
                <div className="flex justify-between text-xs text-[#9B9E96] mb-1.5">
                  <span>Progress</span>
                  <span className="tabular-nums">{completedCount} / {totalSessions}</span>
                </div>
                <div className="h-1.5 bg-[#1A1C18] rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-[#B9E84A]" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#E8EBE4] mb-3">Schedule</h3>
          <div className="text-sm text-[#9B9E96]">
            {assignment.days_of_week?.map((d: number) => DAY_NAMES_FULL[d]).join(", ")}
            {" · "}
            {formatTime(assignment.preferred_time)}
          </div>
        </div>

        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3129]">
            <h3 className="text-sm font-semibold text-[#E8EBE4]">Session History</h3>
          </div>
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {["Date", "Time", "Status", "Notes"].map(h => (
                  <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-[#9B9E96]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sessions.map((s: any) => (
                <tr key={s.id} className="border-b border-[#1A1C18] last:border-b-0">
                  <td className="px-5 py-3 text-sm text-[#E8EBE4]">{formatDate(s.session_date)}</td>
                  <td className="px-5 py-3 text-sm text-[#9B9E96] tabular-nums">{formatTime(s.start_time)}</td>
                  <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-5 py-3 text-xs text-[#9B9E96] max-w-[200px] truncate">{s.notes ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sessions.length && (
            <div className="py-10 text-center text-sm text-[#9B9E96]">No sessions yet</div>
          )}
        </div>

        {feedback.length > 0 && (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129]">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#E8EBE4]">Client Feedback</h3>
                {avgRating && (
                  <div className="flex items-center gap-1.5">
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={11} className={n <= Math.round(Number(avgRating)) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"} />
                      ))}
                    </div>
                    <span className="text-xs text-[#9B9E96]">{avgRating}</span>
                  </div>
                )}
              </div>
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {feedback.map((f: any) => (
                <div key={f.id} className="px-5 py-4">
                  <div className="flex items-center gap-1 mb-1.5">
                    {[1,2,3,4,5].map(n => (
                      <Star key={n} size={11} className={n <= (f.overall_rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"} />
                    ))}
                  </div>
                  <div className="flex gap-3 text-[10px] text-[#9B9E96] mb-1.5">
                    {f.is_punctual !== null && <span>{f.is_punctual ? "✓ Punctual" : "✗ Not punctual"}</span>}
                    {f.satisfied_with_progress !== null && <span>{f.satisfied_with_progress ? "✓ Progress" : "✗ No progress"}</span>}
                    {f.would_continue !== null && <span>{f.would_continue ? "✓ Would continue" : "✗ Would not continue"}</span>}
                  </div>
                  {f.written_feedback && (
                    <p className="text-xs text-[#9B9E96] italic">&quot;{f.written_feedback}&quot;</p>
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
