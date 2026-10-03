import { redirect } from "next/navigation";
import { createClient, getProfile, getGymData } from "@/lib/supabase/server";
import { Bell } from "lucide-react";
import { DashboardContent } from "./dashboard-content";
import type { ExpiryEntry } from "./expiry-types";

function getGreeting(): string {
  const h = parseInt(
    new Date().toLocaleString("en-IN", {
      hour: "numeric",
      hour12: false,
      timeZone: "Asia/Kolkata",
    })
  );
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

export default async function ManagerDashboard({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const { date: dateParam } = await searchParams;
  const targetDate =
    dateParam ??
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const targetDow = new Date(targetDate + "T00:00:00").getDay();

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();
  const gymData = await getGymData(gymId);

  const [
    { data: trainersRaw },
    { data: sessionsRaw },
    { data: assignmentsRaw },
    { data: leavesRaw },
    { data: blockedRaw },
    { data: clientsRaw },
    { data: flaggedRaw },
    { data: packagesRaw },
    { data: assignmentsWithTrainersRaw },
  ] = await Promise.all([
    supabase
      .from("trainers")
      .select("*, trainer_working_hours(*)")
      .eq("gym_id", gymId)
      .eq("status", "active"),
    supabase
      .from("pt_sessions")
      .select("*, pt_clients(id, first_name, last_name)")
      .eq("gym_id", gymId)
      .eq("session_date", targetDate),
    supabase
      .from("pt_assignments")
      .select("*, pt_clients(id, first_name, last_name, profile_picture_url)")
      .eq("gym_id", gymId)
      .eq("status", "active"),
    supabase
      .from("trainer_leaves")
      .select("trainer_id")
      .eq("gym_id", gymId)
      .lte("start_date", targetDate)
      .gte("end_date", targetDate),
    supabase
      .from("trainer_blocked_slots" as any)
      .select("*")
      .eq("gym_id", gymId)
      .eq("blocked_date", targetDate),
    supabase
      .from("pt_clients")
      .select("id, first_name, last_name, phone, profile_picture_url, status")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .order("first_name"),
    supabase
      .from("trainer_feedback")
      .select("id")
      .eq("gym_id", gymId)
      .eq("is_flagged", true),
    // Package expiry: all packages ordered newest-first so grouping picks latest per client
    supabase
      .from("pt_packages")
      .select("id, client_id, package_name, start_date, end_date, amount_collected, created_at, pt_clients(id, first_name, last_name, phone)")
      .eq("gym_id", gymId)
      .order("start_date", { ascending: false })
      .order("created_at", { ascending: false }),
    // Active assignments with trainer names for the expiry popup
    supabase
      .from("pt_assignments")
      .select("client_id, trainer_id, id, trainers(first_name, last_name)")
      .eq("gym_id", gymId)
      .eq("status", "active"),
  ]);

  const trainers = (trainersRaw as any[] | null) ?? [];
  const sessions = (sessionsRaw as any[] | null) ?? [];
  const assignments = (assignmentsRaw as any[] | null) ?? [];
  const flagged = flaggedRaw ?? [];
  const leaveTodayIds = new Set(leavesRaw?.map((l: any) => l.trainer_id) ?? []);
  const slotDuration = gymData?.default_slot_duration ?? 60;

  // Build union of all slot times across working trainers
  const allSlotTimes = new Set<string>();
  trainers.forEach((trainer: any) => {
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

  // Build gridData with clientDetails (enriched for interactivity)
  const gridData = trainers.map((trainer: any) => {
    const isOnLeave = leaveTodayIds.has(trainer.id);
    const todayHours = trainer.trainer_working_hours?.find(
      (wh: any) => wh.day_of_week === targetDow && wh.is_working_day
    );

    const trainerSlots = slots.map((slotTime: string) => {
      const slotHour = parseInt(slotTime.split(":")[0]);

      if (!todayHours) {
        return {
          time: slotTime,
          current: 0,
          max: trainer.max_clients_per_slot,
          isWorking: false,
          isBlocked: false,
          clients: [],
          clientDetails: [],
        };
      }

      const [sh] = todayHours.start_time.split(":").map(Number);
      const [eh] = todayHours.end_time.split(":").map(Number);
      const isWorking = slotHour >= sh && slotHour < eh;

      const isBlocked =
        (blockedRaw as any[])?.some(
          (b: any) =>
            b.trainer_id === trainer.id &&
            b.start_time <= slotTime &&
            b.end_time > slotTime
        ) ?? false;

      // Sessions: exact time match
      const sessionMatches = sessions.filter(
        (s: any) =>
          s.trainer_id === trainer.id &&
          s.start_time === slotTime + ":00"
      );

      // Assignments: fix empty days_of_week bug — empty = all days
      const assignmentMatches = assignments.filter((a: any) => {
        if (a.trainer_id !== trainer.id) return false;
        const d = a.days_of_week as number[];
        const dayMatch = !d || d.length === 0 || d.includes(targetDow);
        if (!dayMatch) return false;
        return parseInt((a.preferred_time as string).split(":")[0]) === slotHour;
      });

      const sessionClientDetails = sessionMatches.map((s: any) => ({
        id: s.pt_clients?.id ?? s.client_id,
        first_name: s.pt_clients?.first_name ?? "",
        last_name: s.pt_clients?.last_name ?? "",
        profile_picture_url: s.pt_clients?.profile_picture_url ?? null,
        assignment_id: undefined,
        preferred_time: slotTime,
      }));

      const assignmentClientDetails = assignmentMatches.map((a: any) => ({
        id: a.pt_clients?.id ?? a.client_id,
        first_name: a.pt_clients?.first_name ?? "",
        last_name: a.pt_clients?.last_name ?? "",
        profile_picture_url: a.pt_clients?.profile_picture_url ?? null,
        assignment_id: a.id,
        preferred_time: a.preferred_time,
        days_of_week: a.days_of_week,
      }));

      const clientDetails =
        sessionMatches.length > 0 ? sessionClientDetails : assignmentClientDetails;
      const clients = clientDetails.map((c: any) => c.first_name).filter(Boolean);

      return {
        time: slotTime,
        current: clients.length,
        max: trainer.max_clients_per_slot,
        isWorking,
        isBlocked,
        clients,
        clientDetails,
      };
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
  });

  // Compute KPIs from gridData
  let totalSlots = 0, filledSlots = 0, freeSlots = 0;
  gridData.forEach((row: any) => {
    if (!row.isOnLeave) {
      row.slots.forEach((s: any) => {
        if (s.isWorking && !s.isBlocked) {
          totalSlots++;
          if (s.current > 0) filledSlots++;
          else freeSlots++;
        }
      });
    }
  });

  const kpis = {
    activeTrainers: trainers.length,
    workingToday: gridData.filter(
      (row: any) => !row.isOnLeave && row.slots.some((s: any) => s.isWorking)
    ).length,
    totalSlots,
    filledSlots,
    freeSlots,
    onLeave: gridData.filter((row: any) => row.isOnLeave).length,
  };

  // Alerts
  const alerts: { text: string; severity: "high" | "medium" }[] = [];
  gridData.forEach((row: any) => {
    if (row.isOnLeave && alerts.length < 2) {
      const affected = sessions.filter((s: any) => s.trainer_id === row.trainer.id).length;
      if (affected > 0) {
        alerts.push({
          text: `${row.trainer.first_name} ${row.trainer.last_name} on leave today — ${affected} session${affected > 1 ? "s" : ""} affected`,
          severity: "high",
        });
      }
    }
  });
  if (flagged.length > 0 && alerts.length < 3) {
    alerts.push({
      text: `${flagged.length} flagged feedback item${flagged.length > 1 ? "s" : ""} need attention`,
      severity: "medium",
    });
  }

  // Compute PT package expiry data
  const packagesAll = (packagesRaw as any[] | null) ?? [];
  const assignmentsWithTrainers = (assignmentsWithTrainersRaw as any[] | null) ?? [];

  // Build trainer lookup by client_id (first active assignment wins)
  const trainerByClientId = new Map<string, { id: string; name: string; assignmentId: string }>();
  for (const a of assignmentsWithTrainers) {
    if (!trainerByClientId.has(a.client_id)) {
      const t = (a as any).trainers;
      trainerByClientId.set(a.client_id, {
        id: a.trainer_id,
        name: t ? `${t.first_name} ${t.last_name}` : "",
        assignmentId: a.id,
      });
    }
  }

  // Group packages by client_id — list is already sorted newest-first, so first entry per client = latest
  const latestPkgByClient = new Map<string, any>();
  for (const pkg of packagesAll) {
    if (!latestPkgByClient.has(pkg.client_id)) {
      latestPkgByClient.set(pkg.client_id, pkg);
    }
  }

  const todayMS = new Date(targetDate + "T00:00:00").getTime();
  const expiryData: ExpiryEntry[] = [];
  for (const [clientId, pkg] of latestPkgByClient) {
    if (!pkg.end_date) continue; // no end date = indefinite, skip
    const endMS = new Date(pkg.end_date + "T00:00:00").getTime();
    const daysUntilExpiry = Math.round((endMS - todayMS) / 86400000);
    if (daysUntilExpiry > 30) continue; // not relevant yet
    const c = (pkg as any).pt_clients;
    const trainerInfo = trainerByClientId.get(clientId);
    expiryData.push({
      clientId,
      clientName: c ? `${c.first_name} ${c.last_name}` : "Unknown",
      clientPhone: c?.phone ?? null,
      trainerName: trainerInfo?.name ?? null,
      trainerId: trainerInfo?.id ?? null,
      assignmentId: trainerInfo?.assignmentId ?? null,
      packageId: pkg.id,
      packageName: pkg.package_name ?? null,
      startDate: pkg.start_date,
      endDate: pkg.end_date,
      daysUntilExpiry,
      amountCollected: pkg.amount_collected ?? null,
      status: daysUntilExpiry < 0 ? "expired" : daysUntilExpiry === 0 ? "today" : daysUntilExpiry <= 7 ? "7days" : "30days",
    });
  }
  expiryData.sort((a, b) => a.daysUntilExpiry - b.daysUntilExpiry);

  const managerName = profile.firstName;
  const gymName = gymData?.name ?? "Iron Kingdom";
  const gymBranch = gymData?.branch_name ?? null;
  const displayDate = new Date(targetDate + "T00:00:00");
  const weekday = displayDate.toLocaleDateString("en-IN", {
    weekday: "long",
    timeZone: "Asia/Kolkata",
  });
  const datePart = displayDate.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    timeZone: "Asia/Kolkata",
  });

  return (
    <div>
      {/* Compact header */}
      <div className="px-6 md:px-8 pt-5 pb-4 border-b border-[#2E3129] bg-[#1A1C18]">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-[#E8EBE4] leading-tight">
              {getGreeting()}{managerName ? `, ${managerName}` : ""}.
            </h1>
            <div className="flex items-center gap-1.5 mt-1 text-[11px] text-[#6B6E67] font-medium">
              <span>{weekday}, {datePart}</span>
              <span className="text-[#2E3129]">·</span>
              <span className="uppercase tracking-wide">{gymName}</span>
              {gymBranch && (
                <>
                  <span className="text-[#2E3129]">·</span>
                  <span className="uppercase tracking-wide">{gymBranch}</span>
                </>
              )}
            </div>
          </div>
          <button className="w-8 h-8 rounded-lg border border-[#2E3129] bg-[#222520] flex items-center justify-center text-[#6B6E67] hover:bg-[#2E3129] transition-colors flex-shrink-0">
            <Bell size={14} />
          </button>
        </div>
      </div>

      {/* Dashboard content */}
      <div className="px-6 md:px-8 py-5">
        <DashboardContent
          date={targetDate}
          slots={slots}
          gridData={gridData as any}
          kpis={kpis}
          clients={(clientsRaw as any[]) ?? []}
          gymId={gymId}
          userId={profile.user.id}
          alerts={alerts}
          expiryData={expiryData}
        />
      </div>
    </div>
  );
}
