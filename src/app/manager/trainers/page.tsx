import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { UserPlus } from "lucide-react";
import { TrainersTable } from "./trainers-table";

export default async function ManagerTrainersPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const targetDate = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const targetDow = new Date(targetDate + "T00:00:00").getDay();
  const nowIST = new Date().toLocaleTimeString("en-CA", { timeZone: "Asia/Kolkata", hour12: false });
  const currentHour = parseInt(nowIST.split(":")[0]);

  const [
    { data: trainersRaw },
    { data: assignmentsRaw },
    { data: feedbackRaw },
    { data: leavesTodayRaw },
    { data: gymData },
  ] = await Promise.all([
    supabase
      .from("trainers")
      .select("id, first_name, last_name, role_title, specializations, joining_date, max_clients_per_slot, status, profile_picture_url, phone, email, trainer_working_hours(*)")
      .eq("gym_id", gymId)
      .order("first_name"),
    supabase
      .from("pt_assignments")
      .select("trainer_id, preferred_time, days_of_week, pt_clients(first_name, last_name)")
      .eq("gym_id", gymId)
      .eq("status", "active"),
    supabase
      .from("trainer_feedback")
      .select("trainer_id, overall_rating")
      .eq("gym_id", gymId),
    supabase
      .from("trainer_leaves")
      .select("trainer_id")
      .eq("gym_id", gymId)
      .lte("start_date", targetDate)
      .gte("end_date", targetDate),
    supabase.from("gyms").select("default_slot_duration").eq("id", gymId).single(),
  ]);

  const slotDuration = gymData?.default_slot_duration ?? 60;
  const leaveSet = new Set((leavesTodayRaw ?? []).map((l: any) => l.trainer_id));

  // Group assignments by trainer
  const assignmentsByTrainer: Record<string, any[]> = {};
  (assignmentsRaw ?? []).forEach((a: any) => {
    if (!assignmentsByTrainer[a.trainer_id]) assignmentsByTrainer[a.trainer_id] = [];
    assignmentsByTrainer[a.trainer_id].push(a);
  });

  // Group feedback ratings by trainer
  const ratingsByTrainer: Record<string, number[]> = {};
  (feedbackRaw ?? []).forEach((f: any) => {
    if (f.overall_rating == null) return;
    if (!ratingsByTrainer[f.trainer_id]) ratingsByTrainer[f.trainer_id] = [];
    ratingsByTrainer[f.trainer_id].push(f.overall_rating);
  });

  const trainers = (trainersRaw ?? []).map((trainer: any) => {
    const isOnLeave = leaveSet.has(trainer.id);
    const wh = (trainer.trainer_working_hours as any[] | null)?.find(
      (h: any) => h.day_of_week === targetDow
    );
    const isWorking = !isOnLeave && wh?.is_working_day === true;

    // Count total working slots for today
    let totalSlots = 0;
    if (isWorking && wh) {
      const [sh, sm] = wh.start_time.split(":").map(Number);
      const [eh, em] = wh.end_time.split(":").map(Number);
      let cur = sh * 60 + sm;
      const end = eh * 60 + em;
      while (cur + slotDuration <= end) { totalSlots++; cur += slotDuration; }
    }

    // Today's assignments: filter by day-of-week match
    const trainerAssignments = assignmentsByTrainer[trainer.id] ?? [];
    const todayAssignments = trainerAssignments.filter((a: any) => {
      const d = a.days_of_week as number[] | null;
      return !d || d.length === 0 || d.includes(targetDow);
    });

    // Occupied slots: count distinct time-slot hours
    const occupiedHours = new Set(
      todayAssignments.map((a: any) => parseInt((a.preferred_time ?? "00:00").split(":")[0]))
    );
    const occupiedSlots = occupiedHours.size;

    // Next PT: earliest slot at or after current hour
    const futureAssignments = todayAssignments
      .filter((a: any) => parseInt((a.preferred_time ?? "00:00").split(":")[0]) >= currentHour)
      .sort((a: any, b: any) => (a.preferred_time ?? "").localeCompare(b.preferred_time ?? ""));
    const nextPt = futureAssignments.length > 0
      ? {
          time: futureAssignments[0].preferred_time as string,
          clientName: `${(futureAssignments[0].pt_clients as any)?.first_name ?? ""} ${(futureAssignments[0].pt_clients as any)?.last_name ?? ""}`.trim(),
        }
      : null;

    // Rating
    const ratings = ratingsByTrainer[trainer.id] ?? [];
    const rating = ratings.length > 0
      ? (ratings.reduce((s, r) => s + r, 0) / ratings.length).toFixed(1)
      : null;

    return {
      id: trainer.id,
      first_name: trainer.first_name,
      last_name: trainer.last_name,
      role_title: trainer.role_title,
      specializations: trainer.specializations,
      status: trainer.status,
      profile_picture_url: trainer.profile_picture_url,
      phone: trainer.phone ?? null,
      email: trainer.email ?? null,
      activeClientCount: trainerAssignments.length,
      rating,
      today: {
        isOnLeave,
        isWorking,
        workStart: wh?.start_time ?? null,
        workEnd: wh?.end_time ?? null,
        totalSlots,
        occupiedSlots,
        nextPt,
      },
    };
  });

  const activeCount = trainers.filter(t => t.status === "active").length;

  return (
    <div>
      <Header
        title="Trainers"
        subtitle={`${activeCount} active trainers`}
        actions={
          <a
            href="/manager/trainers/new"
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-[#B9E84A] text-[#171917] text-xs font-semibold hover:bg-[#A8D63A] transition-colors"
          >
            <UserPlus size={13} />
            Add Trainer
          </a>
        }
      />
      <div className="px-8 py-6">
        <TrainersTable trainers={trainers} />
      </div>
    </div>
  );
}
