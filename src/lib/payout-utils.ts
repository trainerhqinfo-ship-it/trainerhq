import type { SupabaseClient } from "@supabase/supabase-js";

export function getMonthPeriod(month: number, year: number) {
  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { periodStart, periodEnd };
}

export interface ClientBreakdown {
  client_id: string;
  first_name: string;
  last_name: string;
  package_id: string;
  package_name: string | null;
  /** package.start_date, falls back to package.created_at::date if null */
  package_date: string;
  /** pt_packages.amount_collected — the actual amount paid */
  package_amount: number;
  /** sessions purchased (informational only, does not determine commission) */
  sessions_total: number | null;
  commission_type: string | null;
  commission_rate: number | null;
  commission: number;
}

export interface PayoutCalc {
  commission_type: string;
  commission_value: number;
  commission_rule_id: string;
  /** Sum of amount_collected for all packages in this period */
  eligible_revenue: number;
  /** Number of packages that generated commission */
  package_count: number;
  calculated_payout: number;
  breakdown: ClientBreakdown[];
}

/**
 * Single authoritative calculation path for trainer PT commission.
 *
 * Business rules:
 *   - Commission is earned per PT package, not per session and not per active client
 *   - Month is determined by pt_packages.start_date (falls back to created_at::date if null)
 *   - Trainer ownership determined via pt_assignments.package_id → trainer_id
 *   - Fixed:      commission = commission_value  (₹ flat per package)
 *   - Percentage: commission = amount_collected × commission_value / 100
 *   - The applicable commission rule is found by package date vs effective_from/effective_to
 */
export async function calculatePayoutForTrainer(
  supabase: SupabaseClient<any>,
  trainerId: string,
  gymId: string,
  month: number,
  year: number
): Promise<PayoutCalc | null> {
  const { periodStart, periodEnd } = getMonthPeriod(month, year);

  // Step 1: Get all active/cancelled assignments for this trainer with client names
  // We include all statuses because a cancelled assignment still links to its package.
  const { data: assignments } = await supabase
    .from("pt_assignments")
    .select("id, client_id, package_id, pt_clients(id, first_name, last_name)")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .not("package_id", "is", null);

  if (!assignments || assignments.length === 0) return null;

  const packageIds = assignments
    .map((a: any) => a.package_id as string)
    .filter(Boolean);
  if (packageIds.length === 0) return null;

  // Step 2: Get all packages for these assignments (client-side date filter below)
  const { data: packages } = await supabase
    .from("pt_packages")
    .select("id, package_name, amount_collected, total_sessions, start_date, created_at")
    .in("id", packageIds);

  // Filter to packages whose date falls in this period.
  // Primary date: start_date. Fallback: created_at::date (for packages without a start_date).
  const periodPackages = (packages ?? []).filter((pkg: any) => {
    const date: string = pkg.start_date ?? (pkg.created_at as string | undefined)?.slice(0, 10) ?? "";
    return date >= periodStart && date < periodEnd;
  });

  if (periodPackages.length === 0) return null;

  // Build a lookup: package_id → assignment (for client info)
  const assignmentByPackageId: Record<string, any> = {};
  for (const a of assignments) {
    assignmentByPackageId[(a as any).package_id] = a;
  }

  // Step 3: Get all commission rules for this trainer (to handle historical lookups)
  // Ordered by: effective_from DESC → created_at DESC → id DESC (stable tiebreaker)
  const { data: rules } = await supabase
    .from("trainer_commission_rules")
    .select("id, commission_type, commission_value, effective_from, effective_to, created_at")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (!rules || rules.length === 0) return null;

  // Finds the rule applicable on a specific date.
  // Sort is: effective_from DESC, created_at DESC, id DESC — deterministic even when
  // two rules share the same effective_from and created_at (data integrity violation).
  // When multiple rules match, picks the first and logs a warning so the issue is visible.
  function findRuleForDate(packageDate: string) {
    const applicable = (rules ?? []).filter(
      (r: any) =>
        r.effective_from <= packageDate &&
        (r.effective_to === null || r.effective_to >= packageDate)
    );
    if (applicable.length === 0) return null;
    if (applicable.length > 1) {
      console.warn(
        `[payout-utils] Data integrity: trainer ${trainerId} has ${applicable.length} commission rules that apply to package date ${packageDate}. ` +
        `Using rule ${(applicable[0] as any).id} (${(applicable[0] as any).commission_type} ${(applicable[0] as any).commission_value}). ` +
        `Resolve duplicate rules to remove ambiguity.`
      );
    }
    return applicable[0] as any;
  }

  // Step 4: Build per-package breakdown
  const breakdown: ClientBreakdown[] = [];
  let totalPackageRevenue = 0;
  let totalCommission = 0;

  for (const pkg of periodPackages) {
    const packageDate: string =
      (pkg as any).start_date ??
      ((pkg as any).created_at as string | undefined)?.slice(0, 10) ??
      periodStart;
    const amountCollected = Number((pkg as any).amount_collected ?? 0);
    totalPackageRevenue += amountCollected;

    const assignment = assignmentByPackageId[(pkg as any).id];
    const client = (assignment as any)?.pt_clients;
    const rule = findRuleForDate(packageDate);

    let commission = 0;
    let commissionType: string | null = null;
    let commissionRate: number | null = null;

    if (rule) {
      commissionType = rule.commission_type;
      commissionRate = Number(rule.commission_value);
      if (rule.commission_type === "percentage") {
        commission =
          Math.round((amountCollected * Number(rule.commission_value)) / 100 * 100) / 100;
      } else {
        // fixed_per_session = fixed per package (regardless of name)
        commission = Number(rule.commission_value);
      }
      totalCommission += commission;
    }

    breakdown.push({
      client_id: client?.id ?? assignment?.client_id ?? "",
      first_name: client?.first_name ?? "Unknown",
      last_name: client?.last_name ?? "",
      package_id: (pkg as any).id,
      package_name: (pkg as any).package_name ?? null,
      package_date: packageDate,
      package_amount: amountCollected,
      sessions_total: (pkg as any).total_sessions ?? null,
      commission_type: commissionType,
      commission_rate: commissionRate,
      commission,
    });
  }

  // Determine a representative commission rule for the payout record header
  const primaryRule = findRuleForDate(periodStart) ?? (rules[0] as any);

  return {
    commission_type: primaryRule.commission_type,
    commission_value: Number(primaryRule.commission_value),
    commission_rule_id: primaryRule.id,
    eligible_revenue: Math.round(totalPackageRevenue * 100) / 100,
    package_count: periodPackages.length,
    calculated_payout: Math.round(totalCommission * 100) / 100,
    breakdown,
  };
}
