"use server";

import { revalidatePath } from "next/cache";
import { createClient, getProfile } from "@/lib/supabase/server";
import { calculatePayoutForTrainer } from "@/lib/payout-utils";

function calcFinalPayout(
  base_salary: number,
  calculated_payout: number,
  adjustments: number,
  deductions: number
) {
  return Math.round((base_salary + calculated_payout + adjustments - deductions) * 100) / 100;
}

function getTodayCutoff(month: number, year: number): string | undefined {
  const now = new Date();
  const isCurrentMonth =
    month === now.getUTCMonth() + 1 && year === now.getUTCFullYear();
  return isCurrentMonth ? now.toISOString().slice(0, 10) : undefined;
}

/**
 * Update the trainer commission rule on the client's current active package.
 * After saving, refreshes the current month's draft payout for the assigned trainer.
 */
export async function updateClientCommission(
  clientId: string,
  newType: "fixed_monthly" | "percentage" | null,
  newValue: number | null
) {
  const p = await getProfile();
  if (!p) throw new Error("Unauthorized");
  const { gymId } = p;
  const user = p.user;

  const supabase = await createClient();

  // 1. Fetch current active package
  const { data: pkg } = await supabase
    .from("pt_packages")
    .select("id, trainer_payout_type, trainer_payout_value")
    .eq("client_id", clientId)
    .eq("gym_id", gymId)
    .eq("is_active", true)
    .maybeSingle();

  if (!pkg) throw new Error("No active package found for this client");

  const oldType = (pkg as any).trainer_payout_type as string | null;
  const oldValue = (pkg as any).trainer_payout_value as number | null;

  // 2. Update the package (null type clears the package-level rule → falls back to trainer default)
  const { error } = await supabase
    .from("pt_packages")
    .update({
      trainer_payout_type: newType ?? null,
      trainer_payout_value: newType != null && newValue != null && newValue >= 0 ? newValue : null,
    } as any)
    .eq("id", (pkg as any).id)
    .eq("gym_id", gymId);

  if (error) throw new Error(error.message);

  // 3. Find the active trainer assignment for this client
  const { data: assignment } = await supabase
    .from("pt_assignments")
    .select("trainer_id")
    .eq("client_id", clientId)
    .eq("gym_id", gymId)
    .eq("status", "active")
    .maybeSingle();

  const trainerId = (assignment as any)?.trainer_id as string | null;

  // 4. Audit log
  await supabase.from("audit_logs").insert({
    gym_id: gymId,
    user_id: user.id,
    action: "client_commission_updated",
    entity_type: "pt_packages",
    entity_id: (pkg as any).id,
    old_values: { trainer_payout_type: oldType, trainer_payout_value: oldValue },
    new_values: {
      trainer_payout_type: newType,
      trainer_payout_value: newValue,
      client_id: clientId,
      trainer_id: trainerId,
    },
  });

  // 5. Refresh draft payout for the assigned trainer (current month only)
  if (trainerId) {
    const now = new Date();
    const month = now.getUTCMonth() + 1;
    const year = now.getUTCFullYear();

    const { data: existingPayout } = await supabase
      .from("trainer_payouts")
      .select("id, status, adjustments, deductions")
      .eq("trainer_id", trainerId)
      .eq("gym_id", gymId)
      .eq("period_month", month)
      .eq("period_year", year)
      .maybeSingle();

    if (existingPayout && (existingPayout as any).status === "draft") {
      const todayCutoff = getTodayCutoff(month, year);
      const calc = await calculatePayoutForTrainer(
        supabase,
        trainerId,
        gymId,
        month,
        year,
        todayCutoff
      );

      const { data: trainerRow } = await supabase
        .from("trainers")
        .select("base_salary" as any)
        .eq("id", trainerId)
        .eq("gym_id", gymId)
        .single();

      const baseSalary = Number((trainerRow as any)?.base_salary ?? 0);
      const existingAdj = Number((existingPayout as any).adjustments ?? 0);
      const existingDed = Number((existingPayout as any).deductions ?? 0);
      const calculated_payout = calc?.calculated_payout ?? 0;
      const final_payout = calcFinalPayout(baseSalary, calculated_payout, existingAdj, existingDed);

      await supabase
        .from("trainer_payouts")
        .update({
          commission_type: calc?.commission_type ?? "fixed_monthly",
          commission_value: calc?.commission_value ?? 0,
          commission_rule_id: calc?.commission_rule_id ?? null,
          completed_sessions: calc?.package_count ?? 0,
          eligible_revenue: calc?.eligible_revenue ?? 0,
          calculated_payout,
          final_payout,
        } as any)
        .eq("id", (existingPayout as any).id);
    }
  }

  revalidatePath(`/manager/clients/${clientId}`);
  if (trainerId) {
    revalidatePath(`/manager/trainers/${trainerId}`);
    revalidatePath("/manager/payouts");
  }
}
