import { notFound, redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { Badge, StatusBadge } from "@/components/ui/badge";
import { formatCurrency, formatDate, formatTime, DAY_NAMES, DAY_NAMES_FULL } from "@/lib/utils";
import {
  Star, Calendar, Users, TrendingUp, Award, Edit, ShieldCheck,
  ShieldOff, Clock, CheckCircle, XCircle, AlertCircle, BarChart2,
  Phone, Mail, CalendarDays,
} from "lucide-react";
import Link from "next/link";
import { ResetPasswordButton } from "./reset-password-button";
import { CommissionEditor } from "./commission-editor";
import { BaseSalaryEditor } from "./base-salary-editor";
import { TrainerScheduleSection, type ScheduleSlotItem } from "./trainer-schedule-section";
import type { ClientSlotInfo } from "@/components/schedule/schedule-grid";

export default async function TrainerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();

  const targetDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const targetDow = new Date(targetDate + "T00:00:00").getDay();

  const [
    { data: trainer },
    { data: commission },
    { data: workingHoursRaw },
    { data: assignmentsRaw },
    { data: allSessionsRaw },
    { data: feedbackRaw },
    { data: payout },
    { data: gymData },
    { data: leavesTodayRaw },
    { data: blockedTodayRaw },
    { data: sessionsTodayRaw },
    { data: allClientsRaw },
    { data: attendanceRaw },
  ] = await Promise.all([
    supabase.from("trainers").select("*").eq("id", id).eq("gym_id", gymId).single(),
    supabase
      .from("trainer_commission_rules")
      .select("*")
      .eq("trainer_id", id)
      .eq("gym_id", gymId)
      .is("effective_to", null)
      .limit(1)
      .maybeSingle(),
    supabase.from("trainer_working_hours").select("*").eq("trainer_id", id).eq("gym_id", gymId).order("day_of_week"),
    supabase
      .from("pt_assignments")
      .select("*, pt_clients(id, first_name, last_name, phone, profile_picture_url, status)")
      .eq("trainer_id", id)
      .eq("gym_id", gymId)
      .eq("status", "active"),
    supabase
      .from("pt_sessions")
      .select("id, client_id, status, session_revenue, session_date, start_time")
      .eq("trainer_id", id)
      .eq("gym_id", gymId),
    supabase
      .from("trainer_feedback")
      .select("*")
      .eq("trainer_id", id)
      .eq("gym_id", gymId)
      .order("created_at", { ascending: false }),
    supabase
      .from("trainer_payouts")
      .select("*")
      .eq("trainer_id", id)
      .eq("period_month", new Date().getMonth() + 1)
      .eq("period_year", new Date().getFullYear())
      .maybeSingle(),
    supabase.from("gyms").select("default_slot_duration").eq("id", gymId).single(),
    supabase
      .from("trainer_leaves")
      .select("id")
      .eq("trainer_id", id)
      .eq("gym_id", gymId)
      .lte("start_date", targetDate)
      .gte("end_date", targetDate),
    supabase
      .from("trainer_blocked_slots" as any)
      .select("*")
      .eq("trainer_id", id)
      .eq("gym_id", gymId)
      .eq("blocked_date", targetDate),
    supabase
      .from("pt_sessions")
      .select("*, pt_clients(id, first_name, last_name, profile_picture_url)")
      .eq("trainer_id", id)
      .eq("gym_id", gymId)
      .eq("session_date", targetDate),
    supabase
      .from("pt_clients")
      .select("id, first_name, last_name, phone, profile_picture_url, status")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .order("first_name"),
    supabase
      .from("trainer_attendance" as any)
      .select("id, attendance_date, check_in_time, check_out_time, notes")
      .eq("trainer_id", id)
      .eq("gym_id", gymId)
      .order("attendance_date", { ascending: false })
      .limit(5),
  ]);

  if (!trainer) notFound();

  let trainerProfile: any = null;
  if (trainer.user_id) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("id, first_name, last_name")
      .eq("id", trainer.user_id)
      .single();
    trainerProfile = prof;
  }

  const sessions = (allSessionsRaw as any[]) ?? [];
  const assignments = (assignmentsRaw as any[]) ?? [];
  const feedback = (feedbackRaw as any[]) ?? [];
  const workingHours = (workingHoursRaw as any[]) ?? [];
  const sessionsToday = (sessionsTodayRaw as any[]) ?? [];
  const allClients = (allClientsRaw as any[]) ?? [];
  const attendanceRecords = (attendanceRaw as any[]) ?? [];
  const isOnLeaveToday = (leavesTodayRaw?.length ?? 0) > 0;

  // ── Performance metrics (same logic as performance/page.tsx) ──
  const completed = sessions.filter((s: any) => s.status === "completed").length;
  const cancelled = sessions.filter((s: any) => s.status === "cancelled").length;
  const noShow = sessions.filter((s: any) => s.status === "no_show").length;
  const total = completed + cancelled + noShow;
  const utilization = total > 0 ? Math.round((completed / total) * 100) : 0;
  const monthRevenue = sessions
    .filter((s: any) => s.status === "completed")
    .reduce((sum: number, s: any) => sum + (s.session_revenue ?? 0), 0);
  const avgRating =
    feedback.length > 0
      ? (
          feedback.reduce((s: number, f: any) => s + (f.overall_rating ?? 0), 0) /
          feedback.length
        ).toFixed(1)
      : null;

  // ── Enhanced client list: sessions completed per client ──
  const sessionsByClient: Record<string, number> = {};
  sessions.forEach((s: any) => {
    if (s.status === "completed") {
      sessionsByClient[s.client_id] = (sessionsByClient[s.client_id] ?? 0) + 1;
    }
  });

  // Fetch active packages for these clients
  const clientIds = assignments.map((a: any) => a.pt_clients?.id).filter(Boolean);
  let packagesMap: Record<string, any> = {};
  if (clientIds.length > 0) {
    const { data: pkgs } = await supabase
      .from("pt_packages")
      .select("client_id, package_name, total_sessions, is_active")
      .in("client_id", clientIds)
      .eq("gym_id", gymId)
      .eq("is_active", true);
    (pkgs ?? []).forEach((p: any) => { packagesMap[p.client_id] = p; });
  }

  // ── Today's schedule slots ──
  const slotDuration = gymData?.default_slot_duration ?? 60;
  const todayHours = workingHours.find(
    (wh: any) => wh.day_of_week === targetDow && wh.is_working_day
  );

  const allSlotTimes: string[] = [];
  if (todayHours) {
    const [sh, sm] = todayHours.start_time.split(":").map(Number);
    const [eh, em] = todayHours.end_time.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + slotDuration <= end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      allSlotTimes.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      cur += slotDuration;
    }
  }

  const scheduleSlots: ScheduleSlotItem[] = allSlotTimes.map((slotTime) => {
    const slotHour = parseInt(slotTime.split(":")[0]);

    const isBlocked =
      (blockedTodayRaw as any[])?.some(
        (b: any) =>
          b.trainer_id === trainer.id &&
          b.start_time <= slotTime &&
          b.end_time > slotTime
      ) ?? false;

    const sessionMatches = sessionsToday.filter(
      (s: any) => s.start_time === slotTime + ":00"
    );

    const assignmentMatches = assignments.filter((a: any) => {
      const d = a.days_of_week as number[];
      const dayMatch = !d || d.length === 0 || d.includes(targetDow);
      if (!dayMatch) return false;
      return parseInt((a.preferred_time as string).split(":")[0]) === slotHour;
    });

    const sessionDetails: ClientSlotInfo[] = sessionMatches.map((s: any) => ({
      id: s.pt_clients?.id ?? s.client_id,
      first_name: s.pt_clients?.first_name ?? "",
      last_name: s.pt_clients?.last_name ?? "",
      profile_picture_url: s.pt_clients?.profile_picture_url ?? null,
      assignment_id: undefined,
      preferred_time: slotTime,
    }));

    const assignmentDetails: ClientSlotInfo[] = assignmentMatches.map((a: any) => ({
      id: a.pt_clients?.id ?? a.client_id,
      first_name: a.pt_clients?.first_name ?? "",
      last_name: a.pt_clients?.last_name ?? "",
      profile_picture_url: a.pt_clients?.profile_picture_url ?? null,
      assignment_id: a.id,
      preferred_time: a.preferred_time,
      days_of_week: a.days_of_week,
    }));

    const clientDetails =
      sessionMatches.length > 0 ? sessionDetails : assignmentDetails;

    return {
      time: slotTime,
      isWorking: true,
      isOnLeave: isOnLeaveToday,
      isBlocked,
      current: clientDetails.length,
      max: trainer.max_clients_per_slot,
      clientDetails,
    };
  });


  // ── Format attendance duration ──
  function fmtDuration(ci: string | null, co: string | null) {
    if (!ci || !co) return null;
    const [ch, cm] = ci.split(":").map(Number);
    const [oh, om] = co.split(":").map(Number);
    const mins = (oh * 60 + om) - (ch * 60 + cm);
    if (mins <= 0) return null;
    return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  }

  function fmt12(t: string | null) {
    if (!t) return "—";
    const [h, m] = t.split(":").map(Number);
    const ampm = h >= 12 ? "PM" : "AM";
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${ampm}`;
  }

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

        {/* ── Profile Card ── */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-6">
          <div className="flex items-start gap-5">
            <Avatar
              firstName={trainer.first_name}
              lastName={trainer.last_name}
              src={trainer.profile_picture_url}
              size="xl"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-3">
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
                  <div className="font-medium text-[#E8EBE4] mt-0.5">{trainer.experience_years} yrs</div>
                </div>
                <div>
                  <div className="text-xs text-[#9B9E96]">Joined</div>
                  <div className="font-medium text-[#E8EBE4] mt-0.5">{formatDate(trainer.joining_date)}</div>
                </div>
                <div>
                  <div className="text-xs text-[#9B9E96]">Max / Slot</div>
                  <div className="font-bold text-[#E8EBE4] mt-0.5 text-base">{trainer.max_clients_per_slot}</div>
                </div>
                <CommissionEditor
                  trainerId={id}
                  gymId={gymId}
                  commissionType={(commission as any)?.commission_type ?? null}
                  commissionValue={(commission as any)?.commission_value ?? null}
                  commissionRuleId={(commission as any)?.id ?? null}
                />
                <BaseSalaryEditor
                  trainerId={id}
                  gymId={gymId}
                  baseSalary={Number((trainer as any).base_salary ?? 0)}
                />
              </div>
              <div className="mt-4 flex flex-wrap gap-4 text-sm">
                {trainer.phone && (
                  <div className="flex items-center gap-1.5 text-[#9B9E96] text-xs">
                    <Phone size={11} className="text-[#6B6E67]" />
                    {trainer.phone}
                  </div>
                )}
                {trainer.email && (
                  <div className="flex items-center gap-1.5 text-[#9B9E96] text-xs">
                    <Mail size={11} className="text-[#6B6E67]" />
                    {trainer.email}
                  </div>
                )}
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

        {/* ── Stat tiles ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Active Clients", value: assignments.length, icon: <Users size={14} /> },
            { label: "Completed", value: completed, icon: <CheckCircle size={14} /> },
            { label: "Month Revenue", value: formatCurrency(monthRevenue), icon: <TrendingUp size={14} /> },
            { label: "Avg Rating", value: avgRating ? `${avgRating}/5` : "—", icon: <Star size={14} /> },
          ].map((stat) => (
            <div key={stat.label} className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
              <div className="w-7 h-7 rounded-lg bg-[#2E3129] flex items-center justify-center text-[#B9E84A] mb-3">
                {stat.icon}
              </div>
              <div className="text-2xl font-bold text-[#E8EBE4] tabular-nums">{stat.value}</div>
              <div className="text-xs text-[#9B9E96] mt-0.5">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ── TODAY'S SCHEDULE — PRIMARY SECTION ── */}
        <TrainerScheduleSection
          trainer={{
            id: trainer.id,
            first_name: trainer.first_name,
            last_name: trainer.last_name,
            profile_picture_url: trainer.profile_picture_url,
            max_clients_per_slot: trainer.max_clients_per_slot,
          }}
          date={targetDate}
          slots={scheduleSlots}
          allClients={allClients}
          gymId={gymId}
          userId={profile.user.id}
        />

        {/* ── Active Clients + Working Hours ── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">
          {/* Enhanced Active Clients */}
          <div className="xl:col-span-2 bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129] flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#E8EBE4]">Active PT Clients</h3>
              <span className="text-xs text-[#6B6E67]">{assignments.length} assigned</span>
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {assignments.map((a: any) => {
                const client = a.pt_clients;
                if (!client) return null;
                const pkg = packagesMap[client.id];
                const completedForClient = sessionsByClient[client.id] ?? 0;
                const totalSessions = pkg?.total_sessions ?? 0;
                const remaining = totalSessions > 0 ? Math.max(0, totalSessions - completedForClient) : null;
                const days = (a.days_of_week as number[] | null) ?? [];

                return (
                  <Link
                    key={a.id}
                    href={`/manager/clients/${client.id}`}
                    className="flex items-center gap-3 px-5 py-3.5 hover:bg-[#2E3129]/40 transition-colors"
                  >
                    <Avatar
                      firstName={client.first_name}
                      lastName={client.last_name}
                      src={client.profile_picture_url ?? null}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#E8EBE4]">
                          {client.first_name} {client.last_name}
                        </span>
                        <StatusBadge status={client.status} />
                      </div>
                      <div className="text-xs text-[#6B6E67] mt-0.5">
                        {days.length > 0 ? days.map((d: number) => DAY_NAMES[d]).join(" · ") : "All days"}
                        {" · "}{formatTime(a.preferred_time)}
                        {pkg?.package_name && (
                          <span className="ml-2 text-[#4A4D47]">· {pkg.package_name}</span>
                        )}
                      </div>
                    </div>
                    {totalSessions > 0 && (
                      <div className="text-right flex-shrink-0">
                        <div className="text-xs font-semibold text-[#E8EBE4]">
                          {completedForClient}/{totalSessions}
                        </div>
                        <div className={`text-[10px] ${remaining === 0 ? "text-red-400" : remaining !== null && remaining <= 3 ? "text-amber-400" : "text-[#6B6E67]"}`}>
                          {remaining !== null ? `${remaining} left` : "—"}
                        </div>
                      </div>
                    )}
                  </Link>
                );
              })}
              {!assignments.length && (
                <div className="px-5 py-8 text-center">
                  <div className="text-sm text-[#9B9E96]">No active PT clients</div>
                  <div className="text-xs text-[#4A4D47] mt-1">Assign a client from the schedule</div>
                </div>
              )}
            </div>
          </div>

          {/* Right column */}
          <div className="space-y-4">
            {/* Weekly Working Hours */}
            <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#2E3129] flex items-center justify-between">
                <h3 className="text-sm font-semibold text-[#E8EBE4]">Working Hours</h3>
                <Link
                  href={`/manager/trainers/${id}/edit`}
                  className="text-[10px] text-[#6B6E67] hover:text-[#E8EBE4] transition-colors"
                >
                  Edit
                </Link>
              </div>
              <div className="p-4 space-y-2">
                {workingHours.map((wh: any) => (
                  <div
                    key={wh.id}
                    className={`flex items-center justify-between ${wh.day_of_week === targetDow ? "text-[#B9E84A]" : ""}`}
                  >
                    <span className={`text-xs w-10 ${wh.day_of_week === targetDow ? "font-semibold text-[#B9E84A]" : "text-[#9B9E96]"}`}>
                      {DAY_NAMES_FULL[wh.day_of_week].slice(0, 3)}
                    </span>
                    {wh.is_working_day ? (
                      <span className={`text-xs ${wh.day_of_week === targetDow ? "text-[#B9E84A]" : "text-[#E8EBE4]"}`}>
                        {formatTime(wh.start_time)} – {formatTime(wh.end_time)}
                      </span>
                    ) : (
                      <span className="text-xs text-[#4A4D47]">Off</span>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Current Month Payroll */}
            {payout ? (
              <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#2E3129] flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#E8EBE4]">This Month&apos;s Payroll</h3>
                  <Link
                    href={`/manager/payouts/${(payout as any).id}`}
                    className="text-[10px] text-[#6B6E67] hover:text-[#B9E84A] transition-colors"
                  >
                    Full breakdown →
                  </Link>
                </div>
                <div className="p-4 space-y-2">
                  {Number((payout as any).base_salary ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-xs text-[#9B9E96]">Base Salary</span>
                      <span className="text-xs font-medium text-[#E8EBE4] tabular-nums">
                        {formatCurrency((payout as any).base_salary)}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-xs text-[#9B9E96]">PT Revenue</span>
                    <span className="text-xs font-medium text-[#E8EBE4] tabular-nums">{formatCurrency((payout as any).eligible_revenue ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-xs text-[#9B9E96]">
                      PT Commission ({(payout as any).commission_type === "percentage" ? `${(payout as any).commission_value}%` : `₹${(payout as any).commission_value}/pkg`})
                    </span>
                    <span className="text-xs font-medium text-[#E8EBE4] tabular-nums">{formatCurrency((payout as any).calculated_payout ?? 0)}</span>
                  </div>
                  {((payout as any).adjustments ?? 0) !== 0 && (
                    <div className="flex justify-between">
                      <span className="text-xs text-[#9B9E96]">Adjustments</span>
                      <span className={`text-xs tabular-nums ${(payout as any).adjustments < 0 ? "text-red-400" : "text-[#B9E84A]"}`}>
                        {(payout as any).adjustments > 0 ? "+" : ""}{formatCurrency((payout as any).adjustments)}
                      </span>
                    </div>
                  )}
                  {((payout as any).deductions ?? 0) > 0 && (
                    <div className="flex justify-between">
                      <span className="text-xs text-[#9B9E96]">Deductions</span>
                      <span className="text-xs text-red-400 tabular-nums">
                        −{formatCurrency((payout as any).deductions)}
                      </span>
                    </div>
                  )}
                  <div className="border-t border-[#2E3129] pt-2 flex justify-between items-center">
                    <span className="text-xs font-semibold text-[#E8EBE4]">Final Payable</span>
                    <span className="text-sm font-bold text-[#E8EBE4] tabular-nums">{formatCurrency((payout as any).final_payout ?? 0)}</span>
                  </div>
                  <StatusBadge status={(payout as any).status} />
                </div>
              </div>
            ) : (
              <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-[#2E3129]">
                  <h3 className="text-sm font-semibold text-[#E8EBE4]">This Month&apos;s Payroll</h3>
                </div>
                <div className="p-4 text-center text-xs text-[#6B6E67] py-6">
                  No payroll generated yet
                  <div className="mt-1">
                    <Link href="/manager/payouts" className="text-[#B9E84A] hover:underline">Generate payroll →</Link>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Performance Summary ── */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3129]">
            <h3 className="text-sm font-semibold text-[#E8EBE4]">Performance Summary</h3>
            <p className="text-xs text-[#6B6E67] mt-0.5">All-time · {sessions.length} total sessions</p>
          </div>
          <div className="p-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: "Completed", value: completed, icon: <CheckCircle size={14} />, color: "text-[#B9E84A]" },
              { label: "Cancelled", value: cancelled, icon: <XCircle size={14} />, color: "text-red-400" },
              { label: "No Shows", value: noShow, icon: <AlertCircle size={14} />, color: "text-orange-400" },
              { label: "Utilization", value: `${utilization}%`, icon: <BarChart2 size={14} />, color: "text-[#E8EBE4]" },
              { label: "Clients Now", value: assignments.length, icon: <Users size={14} />, color: "text-[#E8EBE4]" },
              { label: "Rating", value: avgRating ? `${avgRating}/5` : "—", icon: <Star size={14} />, color: "text-amber-400" },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <div className={`w-7 h-7 rounded-lg bg-[#2E3129] flex items-center justify-center mx-auto mb-2 ${m.color}`}>
                  {m.icon}
                </div>
                <div className={`text-xl font-bold tabular-nums ${m.color}`}>{m.value}</div>
                <div className="text-[10px] text-[#6B6E67] mt-0.5">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Attendance Placeholder ── */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3129] flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-[#E8EBE4]">Attendance</h3>
              <p className="text-xs text-[#6B6E67] mt-0.5">Machine-based face recognition · coming soon</p>
            </div>
            <Link
              href={`/manager/attendance?trainer=${id}`}
              className="text-xs text-[#6B6E67] hover:text-[#E8EBE4] transition-colors"
            >
              View all
            </Link>
          </div>
          {attendanceRecords.length > 0 ? (
            <div className="divide-y divide-[#1A1C18]">
              {attendanceRecords.map((rec: any) => {
                const dur = fmtDuration(rec.check_in_time, rec.check_out_time);
                return (
                  <div key={rec.id} className="flex items-center gap-4 px-5 py-3">
                    <div className="text-xs text-[#9B9E96] w-24 flex-shrink-0">
                      {new Date(rec.attendance_date + "T00:00:00").toLocaleDateString("en-IN", {
                        day: "numeric", month: "short", timeZone: "Asia/Kolkata",
                      })}
                    </div>
                    <div className="flex-1 flex items-center gap-3 text-xs">
                      <span className="text-[#E8EBE4]">{fmt12(rec.check_in_time)}</span>
                      <span className="text-[#4A4D47]">→</span>
                      <span className="text-[#9B9E96]">{fmt12(rec.check_out_time)}</span>
                    </div>
                    {dur && <span className="text-xs text-[#6B6E67] flex-shrink-0">{dur}</span>}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="px-5 py-6 text-center text-xs text-[#4A4D47]">
              No attendance records yet. Google Sheets sync will populate this section.
            </div>
          )}
        </div>

        {/* ── Trainer Account ── */}
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
                  {trainer.email ? (
                    <ResetPasswordButton trainerEmail={trainer.email} />
                  ) : (
                    <p className="text-xs text-[#6B6E67]">No email address on file.</p>
                  )}
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
                  No login account yet. Create a Supabase Auth user with role &quot;trainer&quot; and link their{" "}
                  <code className="bg-[#1A1C18] px-1 rounded">user_id</code> to this trainer record.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* ── Recent Feedback ── */}
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
                      {[1, 2, 3, 4, 5].map((n) => (
                        <Star
                          key={n}
                          size={12}
                          className={
                            n <= (f.overall_rating ?? 0)
                              ? "text-amber-400 fill-amber-400"
                              : "text-[#2E3129] fill-[#2E3129]"
                          }
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
