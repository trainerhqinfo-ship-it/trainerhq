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

  const [{ data: sessionsRaw }, { data: workingHoursRaw }] = await Promise.all([
    supabase
      .from("pt_sessions")
      .select("id, session_date, start_time, end_time, status, session_revenue, pt_clients(first_name, last_name)")
      .eq("trainer_id", trainerRecord.id)
      .gte("session_date", weekStart)
      .lt("session_date", weekEnd)
      .order("session_date")
      .order("start_time"),
    supabase
      .from("trainer_working_hours")
      .select("day_of_week, is_working_day, start_time, end_time")
      .eq("trainer_id", trainerRecord.id),
  ]);

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
          sessions={(sessionsRaw as any[]) ?? []}
          weekStart={weekStart}
          workingHours={(workingHoursRaw as any[]) ?? []}
          todayIST={todayIST}
        />
      </div>
    </div>
  );
}
