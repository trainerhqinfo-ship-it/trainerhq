import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { Star, AlertTriangle } from "lucide-react";

export default async function FeedbackPage() {
  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();

  const [{ data: feedbackRaw }, { data: trainersData }] = await Promise.all([
    supabase.from("trainer_feedback")
      .select("*, trainers(first_name, last_name), pt_clients(first_name, last_name)")
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false })
      .limit(100),
    supabase.from("trainers").select("id, first_name, last_name").eq("gym_id", gymId),
  ]);

  const feedback = feedbackRaw ?? [];
  const trainers = trainersData ?? [];

  const trainerStats: Record<string, { sum: number; count: number; flagged: number }> = {};
  feedback.forEach((f: any) => {
    if (!trainerStats[f.trainer_id]) trainerStats[f.trainer_id] = { sum: 0, count: 0, flagged: 0 };
    trainerStats[f.trainer_id].sum += f.overall_rating ?? 0;
    trainerStats[f.trainer_id].count += 1;
    if (f.is_flagged) trainerStats[f.trainer_id].flagged += 1;
  });

  const flagged = feedback.filter((f: any) => f.is_flagged);

  return (
    <div>
      <Header title="Client Feedback" subtitle="Trainer quality feedback" />

      <div className="px-8 py-6 space-y-5">
        {/* Trainer summary */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {trainers.map((trainer: any) => {
            const stats = trainerStats[trainer.id];
            const avg = stats && stats.count > 0 ? (stats.sum / stats.count).toFixed(1) : null;
            return (
              <div key={trainer.id} className="bg-[#222520] border border-[#2E3129] rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Avatar firstName={trainer.first_name} lastName={trainer.last_name} size="xs" />
                  <span className="text-xs font-medium text-[#E8EBE4]">{trainer.first_name}</span>
                </div>
                {avg ? (
                  <>
                    <div className="flex items-center gap-1">
                      <Star size={14} className="text-amber-400 fill-amber-400" />
                      <span className="text-base font-bold text-[#E8EBE4]">{avg}</span>
                      <span className="text-xs text-[#6B6E67]">/5</span>
                    </div>
                    <div className="text-[10px] text-[#6B6E67] mt-0.5">{stats.count} responses</div>
                    {stats.flagged > 0 && (
                      <div className="text-[10px] text-red-400 mt-0.5">⚠ {stats.flagged} flagged</div>
                    )}
                  </>
                ) : (
                  <div className="text-xs text-[#6B6E67]">No feedback yet</div>
                )}
              </div>
            );
          })}
        </div>

        {/* Flagged feedback */}
        {flagged.length > 0 && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5">
            <h3 className="text-sm font-semibold text-red-400 mb-3 flex items-center gap-2">
              <AlertTriangle size={15} /> {flagged.length} Flagged Feedback
            </h3>
            <div className="space-y-3">
              {flagged.map((f: any) => {
                const trainer = f.trainers;
                const client = f.pt_clients;
                return (
                  <div key={f.id} className="bg-[#222520] rounded-xl p-4 border border-red-500/30">
                    <div className="flex items-start justify-between mb-2">
                      <div className="text-xs text-[#6B6E67]">
                        <span className="font-medium text-[#E8EBE4]">{client?.first_name} {client?.last_name}</span>
                        {" → "}
                        <span>{trainer?.first_name} {trainer?.last_name}</span>
                      </div>
                      <div className="flex gap-0.5">
                        {[1,2,3,4,5].map(n => (
                          <Star key={n} size={11} className={n <= (f.overall_rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"} />
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 text-[10px] text-[#6B6E67] mb-2">
                      {f.is_punctual !== null && <span>{f.is_punctual ? "✓ Punctual" : "✗ Not punctual"}</span>}
                      {f.satisfied_with_progress !== null && <span>{f.satisfied_with_progress ? "✓ Progress OK" : "✗ Not satisfied with progress"}</span>}
                      {f.would_continue !== null && <span>{f.would_continue ? "✓ Would continue" : "✗ Won't continue"}</span>}
                    </div>
                    {f.written_feedback && (
                      <p className="text-xs text-[#6B6E67] italic">"{f.written_feedback}"</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* All feedback */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3129] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#E8EBE4]">All Feedback</h3>
            <span className="text-[10px] text-[#6B6E67]">Showing the 100 most recent entries</span>
          </div>
          <div className="divide-y divide-[#1A1C18]">
            {feedback.map((f: any) => {
              const trainer = f.trainers;
              const client = f.pt_clients;
              return (
                <div key={f.id} className={`px-5 py-4 ${f.is_flagged ? "bg-red-500/10" : ""}`}>
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-xs font-medium text-[#E8EBE4]">
                        {client?.first_name} {client?.last_name}
                      </div>
                      <div className="text-[10px] text-[#6B6E67]">re: {trainer?.first_name} {trainer?.last_name}</div>
                    </div>
                    <div className="flex gap-0.5">
                      {[1,2,3,4,5].map(n => (
                        <Star key={n} size={12} className={n <= (f.overall_rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"} />
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-3 text-[10px] text-[#6B6E67] mb-1.5">
                    {f.is_punctual !== null && <span>{f.is_punctual ? "✓ Punctual" : "✗ Late"}</span>}
                    {f.satisfied_with_progress !== null && <span>{f.satisfied_with_progress ? "✓ Progress" : "✗ No progress"}</span>}
                    {f.would_continue !== null && <span>{f.would_continue ? "✓ Will continue" : "✗ Won't continue"}</span>}
                  </div>
                  {f.written_feedback && (
                    <p className="text-xs text-[#6B6E67] leading-relaxed">"{f.written_feedback}"</p>
                  )}
                  {f.is_flagged && <span className="text-[10px] text-red-400 font-semibold">⚠ FLAGGED</span>}
                </div>
              );
            })}
            {!feedback.length && (
              <div className="py-12 text-center text-sm text-[#6B6E67]">No feedback yet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
