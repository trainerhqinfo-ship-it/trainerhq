import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { ScheduleGrid } from "@/components/schedule/schedule-grid";

export default async function SchedulePage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const targetDate = dateParam ?? new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const targetDow = new Date(targetDate + "T00:00:00").getDay();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const [
    { data: trainersRaw },
    { data: sessionsRaw },
    { data: assignmentsRaw },
    { data: leaves },
    { data: blocked },
    { data: gym },
  ] = await Promise.all([
    supabase.from("trainers").select("*, trainer_working_hours(*)").eq("gym_id", gymId).eq("status", "active"),
    supabase.from("pt_sessions")
      .select("*, pt_clients(first_name, last_name)")
      .eq("gym_id", gymId)
      .eq("session_date", targetDate),
    supabase.from("pt_assignments")
      .select("*, pt_clients(first_name, last_name)")
      .eq("gym_id", gymId)
      .eq("status", "active"),
    supabase.from("trainer_leaves")
      .select("trainer_id")
      .eq("gym_id", gymId)
      .lte("start_date", targetDate)
      .gte("end_date", targetDate),
    (supabase as any).from("trainer_blocked_slots")
      .select("*")
      .eq("gym_id", gymId)
      .eq("blocked_date", targetDate),
    supabase.from("gyms").select("default_slot_duration").eq("id", gymId).single(),
  ]);

  const trainers = trainersRaw as any[] | null;
  const sessions = sessionsRaw as any[] | null;
  const assignments = assignmentsRaw as any[] | null;

  const slotDuration = gym?.default_slot_duration ?? 60;
  const leaveTodayIds = new Set(leaves?.map((l: any) => l.trainer_id) ?? []);

  const allSlotTimes = new Set<string>();
  trainers?.forEach((trainer: any) => {
    const todayHours = trainer.trainer_working_hours?.find(
      (wh: any) => wh.day_of_week === targetDow && wh.is_working_day
    );
    if (!todayHours) return;
    const [sh, sm] = todayHours.start_time.split(":").map(Number);
    const [eh, em] = todayHours.end_time.split(":").map(Number);
    let cur = sh * 60 + sm;
    const end = eh * 60 + em;
    while (cur + slotDuration <= end) {
      const h = Math.floor(cur / 60);
      const m = cur % 60;
      allSlotTimes.add(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
      cur += slotDuration;
    }
  });

  const slots = Array.from(allSlotTimes).sort();

  const gridData = trainers?.map((trainer: any) => {
    const isOnLeave = leaveTodayIds.has(trainer.id);
    const todayHours = trainer.trainer_working_hours?.find(
      (wh: any) => wh.day_of_week === targetDow && wh.is_working_day
    );

    const trainerSlots = slots.map((slotTime: string) => {
      const slotHour = parseInt(slotTime.split(":")[0]);
      if (!todayHours) return { time: slotTime, current: 0, max: trainer.max_clients_per_slot, isWorking: false, clients: [], isBlocked: false };
      const [sh] = todayHours.start_time.split(":").map(Number);
      const [eh] = todayHours.end_time.split(":").map(Number);
      const isWorking = slotHour >= sh && slotHour < eh;
      const isBlocked = (blocked as any[])?.some(
        (b: any) => b.trainer_id === trainer.id && b.start_time <= slotTime && b.end_time > slotTime
      ) ?? false;
      const sessionClients = sessions?.filter(
        (s: any) => s.trainer_id === trainer.id && s.start_time === slotTime + ":00"
      ).map((s: any) => `${s.pt_clients?.first_name || ""}`) ?? [];
      const assignmentClients = assignments?.filter(
        (a: any) => a.trainer_id === trainer.id &&
          a.days_of_week?.includes(targetDow) &&
          parseInt((a.preferred_time as string).split(":")[0]) === slotHour
      ).map((a: any) => `${a.pt_clients?.first_name || ""}`) ?? [];
      const clients = sessionClients.length > 0 ? sessionClients : assignmentClients;
      return { time: slotTime, current: clients.length, max: trainer.max_clients_per_slot, isWorking, isBlocked, clients };
    });

    return {
      trainer: {
        id: trainer.id,
        first_name: trainer.first_name,
        last_name: trainer.last_name,
        profile_picture_url: trainer.profile_picture_url,
        max_clients_per_slot: trainer.max_clients_per_slot,
        status: trainer.status,
      },
      isOnLeave,
      slots: trainerSlots,
    };
  }) ?? [];

  return (
    <div>
      <Header title="PT Schedule" subtitle="Trainer capacity by time slot" />
      <div className="px-8 py-6">
        <ScheduleGrid
          date={targetDate}
          slots={slots}
          gridData={gridData}
        />
      </div>
    </div>
  );
}
