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
