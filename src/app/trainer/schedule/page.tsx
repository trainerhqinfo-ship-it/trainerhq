import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ScheduleCalendar } from "./schedule-calendar";

function getWeekMonday(param?: string): string {
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const base = new Date((param ?? todayIST) + "T00:00:00");
  const dow = base.getDay();
  base.setDate(base.getDate() + (dow === 0 ? -6 : 1 - dow));
  return base.toISOString().split("T")[0];
}

export default async function TrainerSchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const { week: weekParam } = await searchParams;

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();

  const { data: trainerRecord } = await supabase
    .from("trainers")
    .select("id, first_name, last_name, gym_id")
    .eq("user_id", user.id)
    .single();

  if (!trainerRecord) redirect("/trainer");

  const weekStart = getWeekMonday(weekParam);
  const weekEnd = (() => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + 7);
    return d.toISOString().split("T")[0];
  })();

  // Build the 7 date strings for this week
  const weekDates = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return { dateStr: d.toISOString().split("T")[0], dow: d.getDay() };
  });

  const [
    { data: sessionsRaw },
    { data: workingHoursRaw },
    { data: assignmentsRaw },
  ] = await Promise.all([
    supabase
      .from("pt_sessions")
      .select("id, session_date, start_time, end_time, status, session_revenue, client_id, pt_clients(first_name, last_name)")
      .eq("trainer_id", trainerRecord.id)
      .gte("session_date", weekStart)
      .lt("session_date", weekEnd)
      .order("session_date")
      .order("start_time"),
    supabase
      .from("trainer_working_hours")
      .select("day_of_week, is_working_day, start_time, end_time")
      .eq("trainer_id", trainerRecord.id),
    supabase
      .from("pt_assignments")
      .select("id, client_id, days_of_week, preferred_time, pt_clients(first_name, last_name)")
      .eq("trainer_id", trainerRecord.id)
      .eq("status", "active"),
  ]);

  const sessions     = (sessionsRaw     as any[]) ?? [];
  const assignments  = (assignmentsRaw  as any[]) ?? [];
  const workingHours = (workingHoursRaw as any[]) ?? [];

  // For each assignment, fill in future/missing slots for this week
  // where no actual pt_session record exists for that date + client
  const virtualSessions: any[] = [];
  weekDates.forEach(({ dateStr, dow }) => {
    assignments.forEach((a: any) => {
      if (!a.days_of_week?.includes(dow)) return;
      // skip if an actual session record already exists for this client on this date
      const exists = sessions.some(
        (s: any) => s.session_date === dateStr && s.client_id === a.client_id
      );
      if (!exists) {
        virtualSessions.push({
          id: `v-${a.id}-${dateStr}`,
          session_date: dateStr,
          start_time: a.preferred_time ?? "09:00:00",
          end_time: null,
          status: "scheduled",
          session_revenue: null,
          client_id: a.client_id,
          pt_clients: a.pt_clients,
          isVirtual: true,
        });
      }
    });
  });

  const allSessions = [...sessions, ...virtualSessions].sort(
    (a, b) => a.session_date.localeCompare(b.session_date) || a.start_time.localeCompare(b.start_time)
  );

  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const weekLabel = (() => {
    const s = new Date(weekStart + "T00:00:00");
    const e = new Date(weekStart + "T00:00:00");
    e.setDate(e.getDate() + 6);
    return `${s.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${e.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  return (
    <div>
      <Header title="My Schedule" subtitle={weekLabel} />
      <div className="px-8 py-6">
        <ScheduleCalendar
          sessions={allSessions}
          weekStart={weekStart}
          workingHours={workingHours}
          todayIST={todayIST}
        />
      </div>
    </div>
  );
}
