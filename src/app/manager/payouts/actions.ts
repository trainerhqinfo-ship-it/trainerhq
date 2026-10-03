"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";
import { calculatePayoutForTrainer } from "@/lib/payout-utils";
// NOTE: calculateAttendanceSummary is intentionally NOT imported here.
// Attendance-based salary deductions are disabled until the Google Sheet
// structure is provided. Current formula:
//   Final Payable = Base Salary + PT Commission + Adjustments − Deductions

// ── Shared helper ─────────────────────────────────────────────────────────────
/**
 * Final Payable = base_salary + PT_commission + adjustments − deductions
 *
 * attendance_salary is stored as base_salary (no deduction applied yet).
 * When attendance is enabled, only attendance_salary will change here.
 */
function calcFinalPayout(
  base_salary: number,
  calculated_payout: number,
  adjustments: number,
  deductions: number
) {
  return Math.round((base_salary + calculated_payout + adjustments - deductions) * 100) / 100;
}

// ── Status transition ─────────────────────────────────────────────────────────
export async function updatePayoutStatus(
  payoutId: string,
  newStatus: "reviewed" | "approved" | "paid"
) {
  const p = await getProfile();
  if (!p) throw new Error("Unauthorized");
  const { gymId } = p;
  const user = p.user;

  const supabase = await createClient();

  const { data: payout } = await supabase
    .from("trainer_payouts")
    .select("id, status, trainer_id")
    .eq("id", payoutId)
    .eq("gym_id", gymId)
    .single();

  if (!payout) throw new Error("Payout not found");

  const ORDER: Record<string, number> = { draft: 0, reviewed: 1, approved: 2, paid: 3 };
  if ((ORDER[newStatus] ?? -1) <= (ORDER[(payout as any).status] ?? -1)) {
    throw new Error("Invalid status transition");
  }

  const now = new Date().toISOString();
  const updateData: Record<string, any> = { status: newStatus };
  if (newStatus === "approved") {
    updateData.approved_by = user.id;
    updateData.approved_at = now;
  }
  if (newStatus === "paid") {
    updateData.locked_at = now;
  }

  const { error } = await supabase
    .from("trainer_payouts")
    .update(updateData as any)
    .eq("id", payoutId)
    .eq("gym_id", gymId);

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    gym_id: gymId,
    user_id: user.id,
    action: `payout_${newStatus}`,
    entity_type: "trainer_payouts",
    entity_id: payoutId,
    old_values: { status: (payout as any).status },
    new_values: { status: newStatus, ...updateData },
  });

  revalidatePath("/manager/payouts");
  revalidatePath(`/manager/payouts/${payoutId}`);
  revalidatePath(`/manager/trainers/${(payout as any).trainer_id}`);
}

// ── Adjustments (manual +/−) ──────────────────────────────────────────────────
export async function updatePayoutAdjustment(
  payoutId: string,
  adjustments: number,
  adjustment_notes: string
) {
  const p = await getProfile();
  if (!p) throw new Error("Unauthorized");
  const { gymId } = p;
  const user = p.user;

  const supabase = await createClient();

  const { data: payout } = await supabase
    .from("trainer_payouts")
    .select("id, status, calculated_payout, base_salary, deductions, trainer_id")
    .eq("id", payoutId)
    .eq("gym_id", gymId)
    .single();

  if (!payout) throw new Error("Not found");
  if ((payout as any).status === "paid") throw new Error("Payout is locked");

  const final_payout = calcFinalPayout(
    Number((payout as any).base_salary ?? 0),
    Number((payout as any).calculated_payout ?? 0),
    adjustments,
    Number((payout as any).deductions ?? 0)
  );

  const { error } = await supabase
    .from("trainer_payouts")
    .update({ adjustments, adjustment_notes, final_payout } as any)
    .eq("id", payoutId)
    .eq("gym_id", gymId);

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    gym_id: gymId,
    user_id: user.id,
    action: "payroll_adjustment_updated",
    entity_type: "trainer_payouts",
    entity_id: payoutId,
    new_values: { adjustments, adjustment_notes, final_payout },
  });

  revalidatePath("/manager/payouts");
  revalidatePath(`/manager/payouts/${payoutId}`);
  revalidatePath(`/manager/trainers/${(payout as any).trainer_id}`);
}

// ── Deductions (separate from adjustments) ────────────────────────────────────
export async function updatePayoutDeduction(
  payoutId: string,
  deductions: number,
  deduction_notes: string
) {
  const p = await getProfile();
  if (!p) throw new Error("Unauthorized");
  const { gymId } = p;
  const user = p.user;

  const supabase = await createClient();

  const { data: payout } = await supabase
    .from("trainer_payouts")
    .select("id, status, calculated_payout, base_salary, adjustments, trainer_id")
    .eq("id", payoutId)
    .eq("gym_id", gymId)
    .single();

  if (!payout) throw new Error("Not found");
  if ((payout as any).status === "paid") throw new Error("Payout is locked");

  const final_payout = calcFinalPayout(
    Number((payout as any).base_salary ?? 0),
    Number((payout as any).calculated_payout ?? 0),
    Number((payout as any).adjustments ?? 0),
    deductions
  );

  const { error } = await supabase
    .from("trainer_payouts")
    .update({ deductions, deduction_notes, final_payout } as any)
    .eq("id", payoutId)
    .eq("gym_id", gymId);

  if (error) throw new Error(error.message);

  await supabase.from("audit_logs").insert({
    gym_id: gymId,
    user_id: user.id,
    action: "payroll_adjustment_added",
    entity_type: "trainer_payouts",
    entity_id: payoutId,
    new_values: { deductions, deduction_notes, final_payout },
  });

  revalidatePath("/manager/payouts");
  revalidatePath(`/manager/payouts/${payoutId}`);
  revalidatePath(`/manager/trainers/${(payout as any).trainer_id}`);
}

// ── Recalculate single trainer ─────────────────────────────────────────────────
export async function recalculatePayoutForTrainer(
  trainerId: string,
  gymId: string,
  month: number,
  year: number
) {
  const p = await getProfile();
  if (!p || p.gymId !== gymId) throw new Error("Unauthorized");

  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("trainer_payouts")
    .select("id, status, adjustments, deductions")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .eq("period_month", month)
    .eq("period_year", year)
    .maybeSingle();

  const existingStatus = (existing as any)?.status;
  if (existing && existingStatus !== "draft") {
    return { skipped: true, reason: `payout_already_${existingStatus}` };
  }

  // PT commission (package-based, unchanged)
  const calc = await calculatePayoutForTrainer(supabase, trainerId, gymId, month, year);

  // Base salary (no attendance deduction applied)
  const { data: trainerRowRaw } = await supabase
    .from("trainers")
    .select("base_salary" as any)
    .eq("id", trainerId)
    .eq("gym_id", gymId)
    .single();
  const trainerRow = trainerRowRaw as any;
  const baseSalary = Number(trainerRow?.base_salary ?? 0);

  // No packages AND no salary → delete draft or skip
  if (!calc && baseSalary === 0) {
    if (existing) {
      await supabase.from("trainer_payouts").delete().eq("id", (existing as any).id);
      revalidatePath("/manager/payouts");
      revalidatePath(`/manager/trainers/${trainerId}`);
      return { deleted: true };
    }
    return { skipped: true, reason: "no_packages_no_salary" };
  }

  const existingAdj = Number((existing as any)?.adjustments ?? 0);
  const existingDed = Number((existing as any)?.deductions ?? 0);
  const calculated_payout = calc?.calculated_payout ?? 0;
  const final_payout = calcFinalPayout(baseSalary, calculated_payout, existingAdj, existingDed);

  const payrollFields = {
    base_salary: baseSalary,
    // attendance_salary = base_salary until attendance phase; stored so future
    // formula switch (base_salary → attendance_salary) requires no schema change.
    attendance_salary: baseSalary,
    // attendance deduction fields zeroed — not calculated until attendance phase
    expected_working_days: 0,
    present_days: 0,
    absent_days: 0,
    leave_days: 0,
    attendance_deduction: 0,
    ...(calc
      ? {
          commission_type: calc.commission_type,
          commission_value: calc.commission_value,
          commission_rule_id: calc.commission_rule_id,
          completed_sessions: calc.package_count,
          eligible_revenue: calc.eligible_revenue,
          calculated_payout,
        }
      : {}),
    final_payout,
  };

  if (existing) {
    await supabase
      .from("trainer_payouts")
      .update(payrollFields as any)
      .eq("id", (existing as any).id);
  } else {
    await supabase.from("trainer_payouts").insert({
      gym_id: gymId,
      trainer_id: trainerId,
      period_month: month,
      period_year: year,
      commission_type: calc?.commission_type ?? "fixed_per_session",
      commission_value: calc?.commission_value ?? 0,
      commission_rule_id: calc?.commission_rule_id ?? null,
      completed_sessions: calc?.package_count ?? 0,
      eligible_revenue: calc?.eligible_revenue ?? 0,
      calculated_payout,
      status: "draft",
      ...payrollFields,
    } as any);
  }

  revalidatePath("/manager/payouts");
  revalidatePath(`/manager/trainers/${trainerId}`);
  return { success: true };
}

// ── Generate all payouts for a month ──────────────────────────────────────────
export async function generatePayoutsForMonth(month: number, year: number) {
  const p = await getProfile();
  if (!p) throw new Error("Unauthorized");
  const { gymId } = p;
  const user = p.user;

  const supabase = await createClient();

  const { data: trainersRaw } = await supabase
    .from("trainers")
    .select("id, base_salary" as any)
    .eq("gym_id", gymId)
    .eq("status", "active");
  const trainers = (trainersRaw ?? []) as any[];

  const results = { created: 0, updated: 0, skipped: 0, errors: 0 };

  for (const trainer of trainers) {
    try {
      const { data: existing } = await supabase
        .from("trainer_payouts")
        .select("id, status, adjustments, deductions")
        .eq("trainer_id", trainer.id)
        .eq("gym_id", gymId)
        .eq("period_month", month)
        .eq("period_year", year)
        .maybeSingle();

      if (existing && (existing as any).status !== "draft") {
        results.skipped++;
        continue;
      }

      const calc = await calculatePayoutForTrainer(supabase, trainer.id, gymId, month, year);
      const baseSalary = Number(trainer.base_salary ?? 0);

      if (!calc && baseSalary === 0) {
        results.skipped++;
        continue;
      }

      const existingAdj = Number((existing as any)?.adjustments ?? 0);
      const existingDed = Number((existing as any)?.deductions ?? 0);
      const calculated_payout = calc?.calculated_payout ?? 0;
      const final_payout = calcFinalPayout(baseSalary, calculated_payout, existingAdj, existingDed);

      const payrollFields = {
        base_salary: baseSalary,
        attendance_salary: baseSalary,
        expected_working_days: 0,
        present_days: 0,
        absent_days: 0,
        leave_days: 0,
        attendance_deduction: 0,
        commission_type: calc?.commission_type ?? "fixed_per_session",
        commission_value: calc?.commission_value ?? 0,
        commission_rule_id: calc?.commission_rule_id ?? null,
        completed_sessions: calc?.package_count ?? 0,
        eligible_revenue: calc?.eligible_revenue ?? 0,
        calculated_payout,
        final_payout,
      };

      if (existing) {
        await supabase
          .from("trainer_payouts")
          .update(payrollFields as any)
          .eq("id", (existing as any).id);
        results.updated++;
      } else {
        await supabase.from("trainer_payouts").insert({
          gym_id: gymId,
          trainer_id: trainer.id,
          period_month: month,
          period_year: year,
          status: "draft",
          ...payrollFields,
        } as any);
        results.created++;
      }
    } catch {
      results.errors++;
    }
  }

  await supabase.from("audit_logs").insert({
    gym_id: gymId,
    user_id: user.id,
    action: "payroll_generated",
    entity_type: "trainer_payouts",
    entity_id: gymId,
    new_values: { month, year, ...results },
  });

  revalidatePath("/manager/payouts");
  return results;
}

// ── Detailed per-package CSV for download ─────────────────────────────────────
const FULL_MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function csvEscape(v: string | number | null | undefined): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

export async function getDetailedPayoutsCSV(month: number, year: number): Promise<string> {
  const p = await getProfile();
  if (!p) throw new Error("Unauthorized");
  const { gymId } = p;

  const supabase = await createClient();
  const monthName = FULL_MONTH_NAMES[month - 1];

  const { data: payoutsRaw } = await supabase
    .from("trainer_payouts")
    .select("*, trainers(first_name, last_name, phone, email)")
    .eq("gym_id", gymId)
    .eq("period_month", month)
    .eq("period_year", year);

  const payouts = (payoutsRaw ?? []) as any[];
  if (payouts.length === 0) return "";

  // For each payout, run the authoritative breakdown calculation
  const trainerData: Array<{ payout: any; calc: Awaited<ReturnType<typeof calculatePayoutForTrainer>> }> = [];
  const allPackageIds: string[] = [];

  for (const payout of payouts) {
    const calc = await calculatePayoutForTrainer(supabase, payout.trainer_id, gymId, month, year);
    trainerData.push({ payout, calc });
    if (calc) {
      for (const b of calc.breakdown) allPackageIds.push(b.package_id);
    }
  }

  // Fetch end_dates for all package IDs in one query
  const endDateMap: Record<string, string> = {};
  if (allPackageIds.length > 0) {
    const { data: pkgDates } = await supabase
      .from("pt_packages")
      .select("id, end_date")
      .in("id", allPackageIds);
    for (const pkg of (pkgDates ?? [])) {
      endDateMap[(pkg as any).id] = (pkg as any).end_date ?? "";
    }
  }

  const headers = [
    "Month", "Trainer", "Trainer Phone", "Trainer Email",
    "Client", "Package", "Package Start Date", "Package End Date",
    "Amount Collected", "Commission Type", "Commission Rate", "Commission Earned",
    "Base Salary", "Adjustments", "Deductions", "Final Payout", "Payout Status",
  ];

  const rows: string[] = [headers.map(csvEscape).join(",")];

  for (const { payout, calc } of trainerData) {
    const trainer = payout.trainers;
    const trainerName = `${trainer?.first_name ?? ""} ${trainer?.last_name ?? ""}`.trim();
    const baseSalary = payout.base_salary ?? 0;
    const adjustments = payout.adjustments ?? 0;
    const deductions = payout.deductions ?? 0;
    const finalPayout = payout.final_payout ?? 0;
    const status = payout.status;

    if (calc && calc.breakdown.length > 0) {
      for (const b of calc.breakdown) {
        const commType = b.commission_type === "percentage" ? "Percentage" : "Fixed per package";
        const commRate = b.commission_type === "percentage"
          ? `${b.commission_rate}%`
          : `₹${b.commission_rate}`;
        rows.push([
          csvEscape(`${monthName} ${year}`),
          csvEscape(trainerName),
          csvEscape(trainer?.phone ?? ""),
          csvEscape(trainer?.email ?? ""),
          csvEscape(`${b.first_name} ${b.last_name}`.trim()),
          csvEscape(b.package_name ?? ""),
          csvEscape(b.package_date),
          csvEscape(endDateMap[b.package_id] ?? ""),
          csvEscape(b.package_amount),
          csvEscape(commType),
          csvEscape(commRate),
          csvEscape(b.commission),
          csvEscape(baseSalary),
          csvEscape(adjustments),
          csvEscape(deductions),
          csvEscape(finalPayout),
          csvEscape(status),
        ].join(","));
      }
    } else {
      // Trainer has a payout record but no qualifying packages this month
      rows.push([
        csvEscape(`${monthName} ${year}`),
        csvEscape(trainerName),
        csvEscape(trainer?.phone ?? ""),
        csvEscape(trainer?.email ?? ""),
        csvEscape(""), csvEscape("No PT packages this period"),
        csvEscape(""), csvEscape(""),
        csvEscape(0), csvEscape(""), csvEscape(""), csvEscape(0),
        csvEscape(baseSalary),
        csvEscape(adjustments),
        csvEscape(deductions),
        csvEscape(finalPayout),
        csvEscape(status),
      ].join(","));
    }
  }

  return rows.join("\n");
}
