import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { formatTime, DAY_NAMES_FULL } from "@/lib/utils";
import { AvailabilityFinder } from "./availability-finder";

const DAYS = [1, 2, 3, 4, 5, 6, 0]; // Mon–Sun

export default async function ManagerAvailabilityPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const monthEnd = new Date(
    new Date().getFullYear(),
    new Date().getMonth() + 1,
    0
  ).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const [{ data: activeTrainersRaw }, { data: leavesRaw }, { data: assignmentsRaw }] = await Promise.all([
    supabase.from("trainers")
      .select("id, first_name, last_name, profile_picture_url, status, max_clients_per_slot")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .order("first_name"),
    supabase.from("trainer_leaves")
      .select("trainer_id, start_date, end_date, reason")
      .eq("gym_id", gymId)
      .gte("end_date", today)
      .lte("start_date", monthEnd),
    supabase.from("pt_assignments")
      .select("trainer_id, days_of_week, preferred_time")
      .eq("gym_id", gymId)
      .eq("status", "active"),
  ]);

  const activeTrainers = activeTrainersRaw ?? [];
  const leaves = leavesRaw ?? [];
  const assignments = assignmentsRaw ?? [];

  let workingHours: any[] = [];
  if (activeTrainers.length > 0) {
    const ids = activeTrainers.map((t: any) => t.id);
    const { data: whRaw } = await supabase
      .from("trainer_working_hours")
      .select("*")
      .in("trainer_id", ids);
    workingHours = whRaw ?? [];
  }

  const getHours = (trainerId: string, dow: number) =>
    workingHours.find((wh: any) => wh.trainer_id === trainerId && wh.day_of_week === dow);

  const isOnLeaveToday = (trainerId: string) =>
    leaves.some((l: any) => l.trainer_id === trainerId && l.start_date <= today && l.end_date >= today);

  const upcomingLeaves = leaves.filter((l: any) => l.start_date > today);

  return (
    <div>
      <Header title="Availability" subtitle="Trainer working hours & upcoming leave" />

      <div className="px-8 py-6 space-y-6">
        {/* Slot finder */}
        <AvailabilityFinder
          trainers={activeTrainers as any}
          workingHours={workingHours}
          assignments={assignments as any}
        />

        {/* Weekly schedule grid */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3129]">
            <h2 className="text-sm font-semibold text-[#E8EBE4]">Weekly Schedule</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-[#1A1C18]">
                  <th className="text-left px-5 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide w-36">
                    Trainer
                  </th>
                  {DAYS.map(d => (
                    <th key={d} className="text-center px-2 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide">
                      {DAY_NAMES_FULL[d].slice(0, 3)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activeTrainers.map((trainer: any) => {
                  const onLeave = isOnLeaveToday(trainer.id);
                  return (
                    <tr key={trainer.id} className="border-b border-[#1A1C18] last:border-0">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar firstName={trainer.first_name} lastName={trainer.last_name} src={trainer.profile_picture_url} size="xs" />
                          <span className="text-xs font-medium text-[#E8EBE4] truncate max-w-[80px]">
                            {trainer.first_name}
                          </span>
                          {onLeave && (
                            <span className="text-[9px] bg-yellow-500/10 text-yellow-400 px-1.5 py-0.5 rounded font-medium">LEAVE</span>
                          )}
                        </div>
                      </td>
                      {DAYS.map(d => {
                        const wh = getHours(trainer.id, d);
                        if (!wh) {
                          return <td key={d} className="px-2 py-3 text-center"><span className="text-[10px] text-[#D4D7CF]">—</span></td>;
                        }
                        if (!wh.is_working_day) {
                          return (
                            <td key={d} className="px-2 py-3 text-center">
                              <span className="text-[10px] text-[#6B6E67]">Off</span>
                            </td>
                          );
                        }
                        return (
                          <td key={d} className="px-2 py-3 text-center">
                            <div className="text-[10px] text-[#E8EBE4] font-medium">{formatTime(wh.start_time)}</div>
                            <div className="text-[10px] text-[#6B6E67]">{formatTime(wh.end_time)}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
                {activeTrainers.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-5 py-10 text-center text-sm text-[#6B6E67]">No active trainers</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upcoming leave */}
        {upcomingLeaves.length > 0 ? (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-[#2E3129]">
              <h2 className="text-sm font-semibold text-[#E8EBE4]">Upcoming Leave</h2>
            </div>
            <div className="divide-y divide-[#1A1C18]">
              {upcomingLeaves.map((leave: any, i: number) => {
                const trainer = activeTrainers.find((t: any) => t.id === leave.trainer_id);
                return (
                  <div key={i} className="flex items-center gap-4 px-5 py-3">
                    {trainer && (
                      <Avatar firstName={trainer.first_name} lastName={trainer.last_name} size="xs" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-[#E8EBE4]">
                        {trainer ? `${trainer.first_name} ${trainer.last_name}` : "Unknown"}
                      </div>
                      {leave.reason && (
                        <div className="text-[10px] text-[#6B6E67] truncate">{leave.reason}</div>
                      )}
                    </div>
                    <div className="text-xs text-[#6B6E67] tabular-nums whitespace-nowrap">
                      {leave.start_date} to {leave.end_date}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-8 text-center">
            <p className="text-sm text-[#6B6E67]">No upcoming leave scheduled</p>
          </div>
        )}
      </div>
    </div>
  );
}
