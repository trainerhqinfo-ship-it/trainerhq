import { notFound, redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatTime, DAY_NAMES_FULL } from "@/lib/utils";
import { Star, Calendar, Users, TrendingUp, Award, Edit, ShieldCheck, ShieldOff } from "lucide-react";
import Link from "next/link";
import { ResetPasswordButton } from "./reset-password-button";

export default async function TrainerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const [
    { data: trainer },
    { data: commission },
    { data: workingHoursRaw },
    { data: assignmentsRaw },
    { data: sessionsRaw },
    { data: feedbackRaw },
    { data: payout },
  ] = await Promise.all([
    supabase.from("trainers").select("*").eq("id", id).eq("gym_id", gymId).single(),
    supabase.from("trainer_commission_rules").select("*").eq("trainer_id", id).is("effective_to", null).single(),
    supabase.from("trainer_working_hours").select("*").eq("trainer_id", id).order("day_of_week"),
    supabase.from("pt_assignments").select("*, pt_clients(*)").eq("trainer_id", id).eq("status", "active"),
    supabase.from("pt_sessions").select("*").eq("trainer_id", id).order("session_date", { ascending: false }).limit(20),
    supabase.from("trainer_feedback").select("*").eq("trainer_id", id).order("created_at", { ascending: false }),
    supabase
      .from("trainer_payouts")
      .select("*")
      .eq("trainer_id", id)
      .eq("period_month", new Date().getMonth() + 1)
      .eq("period_year", new Date().getFullYear())
      .single(),
  ]);

  if (!trainer) notFound();

  let trainerProfile: any = null;
  if (trainer.user_id) {
    const { data: prof } = await supabase.from("profiles").select("id, first_name, last_name").eq("id", trainer.user_id).single();
    trainerProfile = prof;
  }

  const sessions = sessionsRaw ?? [];
  const assignments = assignmentsRaw ?? [];
  const feedback = feedbackRaw ?? [];
  const workingHours = workingHoursRaw ?? [];

  const completedSessions = sessions.filter((s: any) => s.status === "completed").length;
  const avgRating = feedback.length > 0
    ? (feedback.reduce((s: number, f: any) => s + (f.overall_rating ?? 0), 0) / feedback.length).toFixed(1)
    : null;
  const monthRevenue = sessions
    .filter((s: any) => s.status === "completed")
    .reduce((sum: number, s: any) => sum + (s.session_revenue ?? 0), 0);

  const trainerEmail = `${trainer.first_name?.toLowerCase()}.${trainer.last_name?.toLowerCase()}@ironkingdom.in`;

  return (
    <div>
      <Header
        title={`${trainer.first_name} ${trainer.last_name}`}
        subtitle={trainer.role_title}
        actions={
          <Link
            href={`/manager/trainers/${id}/edit`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#2E3129] text-xs font-medium text-[#E8EBE4] hover:bg-[#1A1C18] transition-colors"
          >
            <Edit size={12} /> Edit
          </Link>
        }
      />

      <div className="px-8 py-6 space-y-5">
        {/* Profile Card */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6">
          <div className="flex items-start gap-5">
            <Avatar
              firstName={trainer.first_name}
              lastName={trainer.last_name}
              src={trainer.profile_picture_url}
              size="xl"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-[#E8EBE4]">
                    {trainer.first_name} {trainer.last_name}
                  </h2>
                  <p className="text-sm text-[#9B9E96]">{trainer.role_title}</p>
                </div>
                <StatusBadge status={trainer.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {trainer.specializations?.map((s: string) => (
                  <Badge key={s} variant="outline">{s}</Badge>
                ))}
              </div>
              {trainer.bio && (
                <p className="mt-3 text-sm text-[#9B9E96] leading-relaxed max-w-2xl">{trainer.bio}</p>
              )}
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="text-xs text-[#9B9E96]">Experience</div>
                  <div className="font-medium text-[#E8EBE4] mt-0.5">{trainer.experience_years} years</div>
                </div>
                <div>
                  <div className="text-xs text-[#9B9E96]">Joined</div>
                  <div className="font-medium text-[#E8EBE4] mt-0.5">{formatDate(trainer.joining_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-[#9B9E96]">Max Clients/Slot</div>
                  <div className="font-bold text-[#E8EBE4] mt-0.5 text-base">{trainer.max_clients_per_slot}</div>
                </div>
                <div>
                  <div className="text-xs text-[#9B9E96]">Commission</div>
                  <div className="font-medium text-[#E8EBE4] mt-0.5">
                    {commission
                      ? commission.commission_type === "percentage"
                        ? `${commission.commission_value}%`
                        : `₹${commission.commission_value}/session`
                      : "—"}
                  </div>
                </div>
              </div>
              {trainer.certifications?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {trainer.certifications.map((c: string) => (
                    <div key={c} className="flex items-center gap-1 text-xs text-[#9B9E96] bg-[#1A1C18] px-2 py-1 rounded-md">
                      <Award size={11} />
                      {c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Clients", value: assignments.length, icon: <Users size={14} /> },
            { label: "Completed Sessions", value: completedSessions, icon: <Calendar size={14} /> },
            { label: "Month Revenue", value: formatCurrency(monthRevenue), icon: <TrendingUp size={14} /> },
            { label: "Avg Rating", value: avgRating ? `${avgRating}/5` : "—", icon: <Star size={14} /> },
          ].map(stat => (
            <div key={stat.label} className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
              <div className="w-7 h-7 rounded-lg bg-[#2E3129] flex items-center justify-center text-[#B9E84A] mb-3">
                {stat.icon}
              </div>
              <div className="text-2xl font-bold text-[#E8EBE4] tabular-nums">{stat.value}</div>
              <div className="text-xs text-[#9B9E96] mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Active Clients */}
          <div className="xl:col-span-2 bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129]">
              <h3 className="text-sm font-semibold text-[#E8EBE4]">Active PT Clients</h3>
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {assignments.map((a: any) => {
                const client = a.pt_clients;
                if (!client) return null;
                return (
                  <div key={a.id} className="flex items-center gap-3 px-5 py-3">
                    <Avatar firstName={client.first_name} lastName={client.last_name} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[#E8EBE4]">
                        {client.first_name} {client.last_name}
                      </div>
                      <div className="text-xs text-[#9B9E96]">
                        {a.days_of_week?.map((d: number) => DAY_NAMES_FULL[d].slice(0, 3)).join(", ")} · {formatTime(a.preferred_time)}
                      </div>
                    </div>
                    <StatusBadge status={client.status} />
                    <Link href={`/manager/clients/${client.id}`} className="text-xs text-[#9B9E96] hover:text-[#E8EBE4]">
                      View →
                    </Link>
                  </div>
                );
              })}
              {!assignments.length && (
                <div className="px-5 py-8 text-center text-sm text-[#9B9E96]">No active clients</div>
              )}
            </div>
          </div>

          {/* Working Hours & Payout */}
          <div className="space-y-4">
            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2E3129]">
                <h3 className="text-sm font-semibold text-[#E8EBE4]">Working Hours</h3>
              </div>
              <div className="p-4 space-y-2">
                {workingHours.map((wh: any) => (
                  <div key={wh.id} className="flex items-center justify-between">
                    <span className="text-xs text-[#9B9E96] w-10">{DAY_NAMES_FULL[wh.day_of_week].slice(0, 3)}</span>
                    {wh.is_working_day ? (
                      <span className="text-xs text-[#E8EBE4]">
                        {formatTime(wh.start_time)} – {formatTime(wh.end_time)}
                      </span>
                    ) : (
                      <span className="text-xs text-[#9B9E96]">Off</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {payout && (
              <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#2E3129]">
                  <h3 className="text-sm font-semibold text-[#E8EBE4]">Current Month Payout</h3>
                </div>
                <div className="p-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-xs text-[#9B9E96]">Completed sessions</span>
                    <span className="text-xs font-medium text-[#E8EBE4]">{payout.completed_sessions}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#9B9E96]">Eligible revenue</span>
                    <span className="text-xs font-medium text-[#E8EBE4]">{formatCurrency(payout.eligible_revenue)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#9B9E96]">
                      Commission ({payout.commission_type === "percentage" ? `${payout.commission_value}%` : `₹${payout.commission_value}/session`})
                    </span>
                    <span className="text-xs font-medium text-[#E8EBE4]">{formatCurrency(payout.calculated_payout)}</span>
                  </div>
                  <div className="border-t border-[#2E3129] pt-2 flex justify-between">
                    <span className="text-xs font-semibold text-[#E8EBE4]">Final Payout</span>
                    <span className="text-sm font-bold text-[#E8EBE4]">{formatCurrency(payout.final_payout)}</span>
                  </div>
                  <StatusBadge status={payout.status} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trainer Account */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3129]">
            <h3 className="text-sm font-semibold text-[#E8EBE4]">Trainer Account</h3>
          </div>
          <div className="p-5">
            {trainer.user_id && trainerProfile ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9B9E96]">Login status</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-[#B9E84A] bg-[#B9E84A]/15 border border-[#B9E84A]/30 px-2 py-0.5 rounded-full">
                    <ShieldCheck size={11} /> Active
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9B9E96]">Account role</span>
                  <span className="text-xs text-[#E8EBE4] font-medium">trainer</span>
                </div>
                <div className="pt-3 border-t border-[#1A1C18]">
                  <ResetPasswordButton trainerEmail={trainerEmail} />
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[#9B9E96]">Login status</span>
                  <span className="flex items-center gap-1.5 text-xs font-medium text-orange-400 bg-orange-500/15 border border-orange-500/30 px-2 py-0.5 rounded-full">
                    <ShieldOff size={11} /> No account
                  </span>
                </div>
                <p className="text-xs text-[#9B9E96]">
                  This trainer does not have a login account yet. Create a Supabase Auth user with role &quot;trainer&quot; and link their{" "}
                  <code className="bg-[#1A1C18] px-1 rounded">user_id</code> to this trainer record.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Recent Feedback */}
        {feedback.length > 0 && (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129]">
              <h3 className="text-sm font-semibold text-[#E8EBE4]">
                Client Feedback
                <span className="ml-2 text-xs font-normal text-[#9B9E96]">
                  {avgRating}/5 avg · {feedback.length} responses
                </span>
              </h3>
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {feedback.slice(0, 5).map((f: any) => (
                <div key={f.id} className={`px-5 py-4 ${f.is_flagged ? "bg-red-500/10" : ""}`}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex gap-0.5">
                      {[1, 2, 3, 4, 5].map(n => (
                        <Star
                          key={n}
                          size={12}
                          className={n <= (f.overall_rating ?? 0) ? "text-amber-400 fill-amber-400" : "text-[#2E3129] fill-[#2E3129]"}
                        />
                      ))}
                    </div>
                    <div className="flex gap-3 text-[10px] text-[#9B9E96]">
                      {f.is_punctual !== null && (
                        <span>{f.is_punctual ? "✓ Punctual" : "✗ Not punctual"}</span>
                      )}
                      {f.would_continue !== null && (
                        <span>{f.would_continue ? "✓ Would continue" : "✗ Won't continue"}</span>
                      )}
                    </div>
                  </div>
                  {f.written_feedback && (
                    <p className="text-xs text-[#9B9E96] leading-relaxed">&quot;{f.written_feedback}&quot;</p>
                  )}
                  {f.is_flagged && (
                    <span className="text-[10px] text-red-400 font-medium">⚠ Needs attention</span>
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
