import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { AttendanceTable } from "./attendance-table";

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<{ trainer_id?: string; from?: string; to?: string }>;
}) {
  const { trainer_id: filterTrainer, from: fromDate, to: toDate } = await searchParams;

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();

  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const defaultFrom = (() => {
    const d = new Date(today + "T00:00:00");
    d.setDate(d.getDate() - 6);
    return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  })();

  const rangeFrom = fromDate ?? defaultFrom;
  const rangeTo = toDate ?? today;

  const [{ data: trainersRaw }, { data: attendanceRaw }] = await Promise.all([
    supabase
      .from("trainers")
      .select("id, first_name, last_name, profile_picture_url, status")
      .eq("gym_id", gymId)
      .eq("status", "active")
      .order("first_name"),
    supabase
      .from("trainer_attendance")
      .select("*, trainers(first_name, last_name, profile_picture_url)")
      .eq("gym_id", gymId)
      .gte("attendance_date", rangeFrom)
      .lte("attendance_date", rangeTo)
      .order("attendance_date", { ascending: false })
      .order("check_in_time", { ascending: true }),
  ]);

  const trainers = (trainersRaw as any[]) ?? [];
  const allAttendance = (attendanceRaw as any[]) ?? [];

  const attendance = filterTrainer
    ? allAttendance.filter((a) => a.trainer_id === filterTrainer)
    : allAttendance;

  const uniqueDates = new Set(attendance.map((a: any) => a.attendance_date));
  const totalPresent = attendance.length;
  const completedCount = attendance.filter(
    (a: any) => a.check_in_time && a.check_out_time
  ).length;

  return (
    <div>
      <Header title="Trainer Attendance" subtitle="Daily check-in & check-out records" />

      <div className="px-8 py-6 space-y-5">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Days in Range", value: uniqueDates.size },
            { label: "Total Entries", value: totalPresent },
            { label: "Full Days (checked out)", value: completedCount },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#222520] border border-[#2E3129] rounded-xl px-4 py-3">
              <div className="text-2xl font-bold text-[#E8EBE4] tabular-nums">{value}</div>
              <div className="text-xs text-[#6B6E67] mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Table with filter bar, edit/delete wired in */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3129] space-y-4">
            <h2 className="text-sm font-semibold text-[#E8EBE4]">Records</h2>
            <p className="text-xs text-[#6B6E67]">
              {rangeFrom} — {rangeTo}
              {filterTrainer && " · Filtered by trainer"}
            </p>
          </div>
          <div className="px-5 py-4 border-b border-[#2E3129]">
            <AttendanceTable
              trainers={trainers}
              attendance={attendance}
              filterTrainer={filterTrainer ?? ""}
              rangeFrom={rangeFrom}
              rangeTo={rangeTo}
              gymId={gymId}
              userId={profile.user.id}
            />
          </div>
        </div>

        {/* Google Sheets info */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
          <h3 className="text-sm font-semibold text-[#E8EBE4] mb-2">Google Sheets Integration</h3>
          <p className="text-xs text-[#6B6E67] leading-relaxed">
            Connect a Google Sheet to automatically sync attendance. The system reads column headers
            from row 1 — no fixed layout assumed. Configure the sheet URL and column mapping in
            Settings once available.
          </p>
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#2E3129] rounded-lg text-[10px] text-[#6B6E67]">
            Coming soon · manual entry available now
          </div>
        </div>
      </div>
    </div>
  );
}
