import type { SupabaseClient } from "@supabase/supabase-js";
import { getMonthPeriod } from "./payout-utils";

export type AttendanceStatus =
  | "present"             // check_in exists + check_out exists
  | "present_no_checkout" // check_in exists, check_out missing
  | "absent"              // expected working day, no check_in, no approved leave
  | "leave"               // falls within an approved trainer_leave record
  | "non_working";        // not an expected working day per trainer_working_hours

export interface DayDetail {
  date: string;        // YYYY-MM-DD
  day_of_week: number; // 0=Sun … 6=Sat (JS convention)
  status: AttendanceStatus;
}

export interface AttendanceCalc {
  base_salary: number;
  expected_working_days: number;
  present_days: number;          // present + present_no_checkout
  absent_days: number;
  leave_days: number;
  missing_checkout_days: number; // subset of present_days
  daily_salary: number;          // base_salary / expected_working_days
  attendance_deduction: number;  // absent_days × daily_salary
  attendance_salary: number;     // base_salary − attendance_deduction
  working_days_configured: boolean; // false when no trainer_working_hours records found
  days: DayDetail[];
}

/**
 * Calculates attendance summary for a trainer for a given month.
 *
 * Working days: from trainer_working_hours.is_working_day per day_of_week.
 * Fallback (no hours configured): Mon–Sat (day_of_week 1–6).
 *
 * Leave: approved leave from trainer_leaves (status = 'approved').
 * Approved leave is NOT counted as absence — no deduction.
 *
 * Attendance source: trainer_attendance (check_in_time / check_out_time).
 * Google Sheets sync will populate this table once connected.
 *
 * Deduction formula (when base_salary > 0):
 *   daily_salary = base_salary / expected_working_days
 *   deduction    = absent_days × daily_salary
 *   salary       = base_salary − deduction
 *
 * No deduction policy is hardcoded. If base_salary = 0, all salary fields = 0.
 */
export async function calculateAttendanceSummary(
  supabase: SupabaseClient<any>,
  trainerId: string,
  gymId: string,
  month: number,
  year: number,
  baseSalary: number
): Promise<AttendanceCalc> {
  const { periodStart, periodEnd } = getMonthPeriod(month, year);

  // ── Working day config ────────────────────────────────────────────────────
  const { data: workingHoursRaw } = await supabase
    .from("trainer_working_hours")
    .select("day_of_week, is_working_day")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId);

  const workingHours = workingHoursRaw ?? [];
  const working_days_configured = workingHours.length > 0;
  const workingDaySet = new Set<number>();

  if (working_days_configured) {
    for (const wh of workingHours) {
      if ((wh as any).is_working_day) workingDaySet.add((wh as any).day_of_week);
    }
  } else {
    // Fallback: Mon–Sat. Manager should configure working hours per trainer.
    for (let d = 1; d <= 6; d++) workingDaySet.add(d);
  }

  // ── Attendance records ────────────────────────────────────────────────────
  const { data: attendanceRaw } = await supabase
    .from("trainer_attendance")
    .select("attendance_date, check_in_time, check_out_time")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .gte("attendance_date", periodStart)
    .lt("attendance_date", periodEnd);

  const attendanceByDate: Record<string, { check_in: string | null; check_out: string | null }> = {};
  for (const a of attendanceRaw ?? []) {
    attendanceByDate[(a as any).attendance_date] = {
      check_in: (a as any).check_in_time ?? null,
      check_out: (a as any).check_out_time ?? null,
    };
  }

  // ── Approved leaves ───────────────────────────────────────────────────────
  const { data: leavesRaw } = await supabase
    .from("trainer_leaves")
    .select("start_date, end_date, status")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .lte("start_date", periodEnd)
    .gte("end_date", periodStart);

  const approvedLeaveDates = new Set<string>();
  for (const lv of leavesRaw ?? []) {
    const status: string = (lv as any).status ?? "approved";
    if (status !== "approved") continue;
    const start = new Date((lv as any).start_date + "T00:00:00Z");
    const end = new Date((lv as any).end_date + "T00:00:00Z");
    const cur = new Date(start);
    while (cur <= end) {
      approvedLeaveDates.add(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  }

  // ── Day-by-day iteration ──────────────────────────────────────────────────
  const days: DayDetail[] = [];
  const cur = new Date(periodStart + "T00:00:00Z");
  const endExclusive = new Date(periodEnd + "T00:00:00Z");

  while (cur < endExclusive) {
    const dateStr = cur.toISOString().slice(0, 10);
    const dow = cur.getUTCDay(); // 0=Sun … 6=Sat (UTC safe — date is midnight UTC)

    let status: AttendanceStatus;
    if (!workingDaySet.has(dow)) {
      status = "non_working";
    } else if (approvedLeaveDates.has(dateStr)) {
      status = "leave";
    } else if (attendanceByDate[dateStr]) {
      status = attendanceByDate[dateStr].check_out ? "present" : "present_no_checkout";
    } else {
      status = "absent";
    }

    days.push({ date: dateStr, day_of_week: dow, status });
    cur.setUTCDate(cur.getUTCDate() + 1);
  }

  // ── Aggregates ────────────────────────────────────────────────────────────
  const expected_working_days = days.filter((d) => d.status !== "non_working").length;
  const present_days = days.filter(
    (d) => d.status === "present" || d.status === "present_no_checkout"
  ).length;
  const absent_days = days.filter((d) => d.status === "absent").length;
  const leave_days = days.filter((d) => d.status === "leave").length;
  const missing_checkout_days = days.filter((d) => d.status === "present_no_checkout").length;

  const daily_salary =
    baseSalary > 0 && expected_working_days > 0
      ? Math.round((baseSalary / expected_working_days) * 100) / 100
      : 0;
  const attendance_deduction = Math.round(absent_days * daily_salary * 100) / 100;
  const attendance_salary = Math.round((baseSalary - attendance_deduction) * 100) / 100;

  return {
    base_salary: baseSalary,
    expected_working_days,
    present_days,
    absent_days,
    leave_days,
    missing_checkout_days,
    daily_salary,
    attendance_deduction,
    attendance_salary,
    working_days_configured,
    days,
  };
}
