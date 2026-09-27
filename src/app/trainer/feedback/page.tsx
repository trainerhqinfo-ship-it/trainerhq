import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Star, ThumbsUp, Clock, TrendingUp, RefreshCw } from "lucide-react";

export default async function TrainerRatingPage() {
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
      <div className="px-8 py-16 text-center">
        <p className="text-[#6B6E67]">Trainer profile not found.</p>
      </div>
    );
  }

  const { data: feedbackRaw } = await supabase
    .from("trainer_feedback")
    .select("overall_rating, is_punctual, satisfied_with_progress, would_continue, written_feedback, created_at")
    .eq("trainer_id", trainer.id)
    .order("created_at", { ascending: false });

  const feedback = feedbackRaw ?? [];
  const total = feedback.length;

  const avgRating = total > 0
    ? (feedback.reduce((s: number, f: any) => s + (f.overall_rating ?? 0), 0) / total)
    : null;

  const punctualCount = feedback.filter((f: any) => f.is_punctual === true).length;
  const progressCount = feedback.filter((f: any) => f.satisfied_with_progress === true).length;
  const continueCount = feedback.filter((f: any) => f.would_continue === true).length;

  const punctualPct = total > 0 ? Math.round((punctualCount / total) * 100) : null;
  const progressPct = total > 0 ? Math.round((progressCount / total) * 100) : null;
  const continuePct = total > 0 ? Math.round((continueCount / total) * 100) : null;

  const ratingDisplay = avgRating ? avgRating.toFixed(1) : null;
  const ratingRounded = avgRating ? Math.round(avgRating) : 0;

  const metrics = [
    { label: "Client Satisfaction", pct: avgRating ? Math.round((avgRating / 5) * 100) : null, icon: <ThumbsUp size={15} />, display: ratingDisplay ? `${ratingDisplay}/5` : "—" },
    { label: "Punctuality", pct: punctualPct, icon: <Clock size={15} />, display: punctualPct !== null ? `${punctualPct}%` : "—" },
    { label: "Progress Satisfaction", pct: progressPct, icon: <TrendingUp size={15} />, display: progressPct !== null ? `${progressPct}%` : "—" },
    { label: "Continue Training", pct: continuePct, icon: <RefreshCw size={15} />, display: continuePct !== null ? `${continuePct}%` : "—" },
  ];

  const writtenFeedback = feedback.filter((f: any) => f.written_feedback);

  return (
    <div>
      <Header title="My Rating" subtitle={total > 0 ? `Based on ${total} review${total !== 1 ? "s" : ""}` : "No reviews yet"} />
      <div className="px-4 md:px-8 py-6 space-y-5 max-w-2xl">

        {/* Hero rating */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6 text-center">
          {ratingDisplay ? (
            <>
              <div className="text-5xl font-bold text-[#E8EBE4] tabular-nums tracking-tight">{ratingDisplay}</div>
              <div className="text-sm text-[#6B6E67] mt-1">out of 5.0</div>
              <div className="flex items-center justify-center gap-1 mt-3">
                {[1, 2, 3, 4, 5].map(n => (
                  <Star
                    key={n}
                    size={22}
                    className={n <= ratingRounded ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"}
                  />
                ))}
              </div>
              <div className="text-xs text-[#6B6E67] mt-2">{total} client review{total !== 1 ? "s" : ""}</div>
            </>
          ) : (
            <div className="py-6">
              <div className="text-3xl font-bold text-[#D5D7D0]">—</div>
              <div className="text-sm text-[#6B6E67] mt-2">No ratings yet</div>
              <p className="text-xs text-[#6B6E67] mt-1">Ratings appear after clients submit feedback</p>
            </div>
          )}
        </div>

        {/* Metric breakdown */}
        <div className="grid grid-cols-2 gap-3">
          {metrics.map(m => (
            <div key={m.label} className="bg-[#222520] border border-[#2E3129] rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-[#6B6E67] mb-2">
                {m.icon}
                <span className="text-[10px] font-medium uppercase tracking-wide">{m.label}</span>
              </div>
              <div className="text-2xl font-bold text-[#E8EBE4] tabular-nums">{m.display}</div>
              {m.pct !== null && (
                <div className="mt-2 h-1 bg-[#1A1C18] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${m.pct >= 80 ? "bg-[#B9E84A]" : m.pct >= 60 ? "bg-amber-400" : "bg-red-400"}`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Recent feedback */}
        {writtenFeedback.length > 0 && (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129]">
              <h3 className="text-sm font-semibold text-[#E8EBE4]">Recent Feedback</h3>
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {writtenFeedback.slice(0, 5).map((f: any, i: number) => (
                <div key={i} className="px-5 py-4">
                  <div className="flex items-center gap-1 mb-2">
                    {[1, 2, 3, 4, 5].map(n => (
                      <Star key={n} size={12} className={n <= (f.overall_rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"} />
                    ))}
                    <span className="text-[10px] text-[#6B6E67] ml-1.5">
                      {new Date(f.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </span>
                  </div>
                  <p className="text-sm text-[#6B6E67] italic leading-relaxed">&quot;{f.written_feedback}&quot;</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {total === 0 && (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl py-12 text-center">
            <Star size={28} className="mx-auto text-[#D5D7D0] mb-3" />
            <p className="text-sm text-[#6B6E67]">Client reviews will appear here</p>
            <p className="text-xs text-[#6B6E67] mt-1">Your manager can collect feedback from your clients</p>
          </div>
        )}
      </div>
    </div>
  );
}
