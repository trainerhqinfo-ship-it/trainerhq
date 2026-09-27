import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { StatusBadge } from "@/components/ui/badge";
import { formatTime } from "@/lib/utils";
import { WeekNav } from "./week-nav";

function getWeekMonday(param?: string): string {
  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const base = new Date((param ?? todayIST) + "T00:00:00");
  const dow = base.getDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  base.setDate(base.getDate() + diff);
  return base.toISOString().split("T")[0];
}

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAY_FULL  = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

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

  const sessions = sessionsRaw ?? [];
  const workingHours = workingHoursRaw ?? [];

  const todayIST = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  // Build 7 days: Mon(0)…Sun(6)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().split("T")[0];
    const jsDay = d.getDay(); // 0=Sun..6=Sat → convert to Mon=1..Sun=0 working hours convention
    const wh = workingHours.find((w: any) => w.day_of_week === jsDay);
    const daySessions = sessions.filter((s: any) => s.session_date === dateStr);
    return { dateStr, label: DAY_SHORT[i], fullLabel: DAY_FULL[i], jsDay, wh, sessions: daySessions, isToday: dateStr === todayIST };
  });

  const totalSessions  = sessions.length;
  const completed      = sessions.filter((s: any) => s.status === "completed").length;
  const upcoming       = sessions.filter((s: any) => s.status === "scheduled").length;
  const cancelled      = sessions.filter((s: any) => s.status === "cancelled" || s.status === "no_show").length;

  const weekLabel = (() => {
    const start = new Date(weekStart + "T00:00:00");
    const end   = new Date(weekStart + "T00:00:00");
    end.setDate(end.getDate() + 6);
    return `${start.toLocaleDateString("en-IN", { day: "numeric", month: "short" })} – ${end.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`;
  })();

  return (
    <div>
      <Header title="My Schedule" subtitle={weekLabel} />

      <div className="px-8 py-6 space-y-5">

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total This Week", value: totalSessions, color: "text-[#E8EBE4]" },
            { label: "Completed",       value: completed,    color: "text-[#B9E84A]" },
            { label: "Upcoming",        value: upcoming,     color: "text-sky-400" },
            { label: "Cancelled / No-show", value: cancelled, color: "text-red-400" },
          ].map(s => (
            <div key={s.label} className="bg-[#222520] border border-[#2E3129] rounded-2xl px-5 py-4">
              <div className={`text-2xl font-bold tabular-nums ${s.color}`}>{s.value}</div>
              <div className="text-xs text-[#9B9E96] mt-0.5">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Week navigation */}
        <WeekNav weekStart={weekStart} />

        {/* Week grid */}
        <div className="grid grid-cols-1 sm:grid-cols-7 gap-3">
          {days.map(day => {
            const isOff = !day.wh || !day.wh.is_working_day;
            return (
              <div
                key={day.dateStr}
                className={`rounded-2xl border overflow-hidden flex flex-col ${
                  day.isToday
                    ? "border-[#B9E84A]/50 bg-[#B9E84A]/5"
                    : "border-[#2E3129] bg-[#222520]"
                }`}
              >
                {/* Day header */}
                <div className={`px-3 py-2.5 border-b flex items-center justify-between ${
                  day.isToday ? "border-[#B9E84A]/30 bg-[#B9E84A]/10" : "border-[#1A1C18]"
                }`}>
                  <div>
                    <span className={`text-xs font-semibold ${day.isToday ? "text-[#B9E84A]" : "text-[#E8EBE4]"}`}>
                      {day.label}
                    </span>
                    <span className="text-[10px] text-[#9B9E96] ml-1.5">
                      {new Date(day.dateStr + "T00:00:00").getDate()}
                    </span>
                  </div>
                  {day.sessions.length > 0 && (
                    <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                      day.isToday ? "bg-[#B9E84A]/20 text-[#B9E84A]" : "bg-[#1A1C18] text-[#9B9E96]"
                    }`}>
                      {day.sessions.length}
                    </span>
                  )}
                </div>

                {/* Sessions */}
                <div className="flex-1 p-2 space-y-1.5 min-h-[80px]">
                  {isOff && day.sessions.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-4">
                      <span className="text-[10px] text-[#6B6E67]">Day off</span>
                    </div>
                  ) : day.sessions.length === 0 ? (
                    <div className="flex items-center justify-center h-full py-4">
                      <span className="text-[10px] text-[#6B6E67]">No sessions</span>
                    </div>
                  ) : (
                    day.sessions.map((s: any) => {
                      const client = s.pt_clients;
                      const statusColor =
                        s.status === "completed" ? "border-[#B9E84A]/30 bg-[#B9E84A]/5" :
                        s.status === "cancelled" || s.status === "no_show" ? "border-red-500/20 bg-red-500/5" :
                        "border-sky-500/20 bg-sky-500/5";
                      return (
                        <div key={s.id} className={`rounded-lg border p-2 ${statusColor}`}>
                          <div className="text-[11px] font-semibold text-[#E8EBE4] truncate">
                            {client?.first_name} {client?.last_name}
                          </div>
                          <div className="text-[10px] text-[#9B9E96] mt-0.5">
                            {formatTime(s.start_time)}
                          </div>
                          <div className="mt-1">
                            <StatusBadge status={s.status} />
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Working hours footer */}
                {day.wh?.is_working_day && (
                  <div className="px-3 py-1.5 border-t border-[#1A1C18]">
                    <span className="text-[9px] text-[#6B6E67]">
                      {formatTime(day.wh.start_time)} – {formatTime(day.wh.end_time)}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Session list (compact detail view) */}
        {sessions.length > 0 && (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129]">
              <h3 className="text-sm font-semibold text-[#E8EBE4]">All sessions this week</h3>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#1A1C18]">
                  {["Date", "Time", "Client", "Status", "Revenue"].map(h => (
                    <th key={h} className="text-left px-5 py-3 text-[11px] font-medium text-[#9B9E96]">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: any) => {
                  const client = s.pt_clients;
                  const d = new Date(s.session_date + "T00:00:00");
                  return (
                    <tr key={s.id} className="border-b border-[#1A1C18] last:border-0">
                      <td className="px-5 py-3 text-sm text-[#E8EBE4]">
                        {d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}
                      </td>
                      <td className="px-5 py-3 text-sm text-[#9B9E96]">{formatTime(s.start_time)}</td>
                      <td className="px-5 py-3 text-sm text-[#E8EBE4]">
                        {client?.first_name} {client?.last_name}
                      </td>
                      <td className="px-5 py-3"><StatusBadge status={s.status} /></td>
                      <td className="px-5 py-3 text-sm text-[#9B9E96]">
                        {s.session_revenue ? `₹${Number(s.session_revenue).toLocaleString("en-IN")}` : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
