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
  /** package.start_date — when the package was bought/started */
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
  /** Sum of amount_collected for all eligible packages in this period */
  eligible_revenue: number;
  /** Number of active PT clients with eligible packages */
  package_count: number;
  calculated_payout: number;
  breakdown: ClientBreakdown[];
}

/**
 * Single authoritative calculation path for trainer PT commission.
 *
 * Eligibility rules (all must hold):
 *   1. Trainer has an ACTIVE assignment (status='active') to the client.
 *   2. The client's CURRENT package is active (is_active=true).
 *   3. The client is active (pt_clients.status='active').
 *   4. The package's start_date falls within the payout month
 *      (commission is earned in the month the package is purchased).
 *   5. Each client counted at most once (deduplication guard).
 *
 * Commission formula:
 *   Fixed:      commission = commission_value  (₹ flat per package)
 *   Percentage: commission = amount_collected × commission_value / 100
 *
 * The applicable commission rule is found by package start_date vs effective_from/effective_to.
 *
 * Note on start_date fallback: if start_date is NULL, created_at::date is used.
 * This is only a safety net — packages should always have start_date set.
 */
export async function calculatePayoutForTrainer(
  supabase: SupabaseClient<any>,
  trainerId: string,
  gymId: string,
  month: number,
  year: number
): Promise<PayoutCalc | null> {
  const { periodStart, periodEnd } = getMonthPeriod(month, year);

  // Step 1: Trainer's ACTIVE assignments (status='active' only).
  // We no longer use package_id on assignments — that field is not reliably set
  // (neither onboarding nor renewal sets it). We join through client_id instead.
  const { data: assignments } = await supabase
    .from("pt_assignments")
    .select("id, client_id")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .eq("status", "active");

  if (!assignments || assignments.length === 0) return null;

  // Deduplicate client_ids (guard against duplicate active assignments)
  const clientIds = [
    ...new Set((assignments as any[]).map((a) => a.client_id).filter(Boolean)),
  ];
  if (clientIds.length === 0) return null;

  // Step 2: Current packages for these clients.
  // is_active=true means this is the client's non-replaced, current package.
  // Join pt_clients to check client status.
  const { data: packagesRaw } = await supabase
    .from("pt_packages")
    .select(
      "id, client_id, package_name, amount_collected, total_sessions, start_date, end_date, created_at, pt_clients(id, first_name, last_name, status)"
    )
    .in("client_id", clientIds)
    .eq("gym_id", gymId)
    .eq("is_active", true);

  // Step 3: Apply date + client-status filter; deduplicate per client.
  // Commission is earned in the month the package starts (start_date IN period).
  // Only active clients are eligible.
  const packagesByClient: Record<
    string,
    { pkg: any; date: string; client: any }
  > = {};

  for (const pkg of (packagesRaw ?? []) as any[]) {
    const client = pkg.pt_clients;
    if (!client || client.status !== "active") continue;

    // Primary date: start_date. Fallback: created_at (safety net for legacy data).
    const date: string =
      pkg.start_date ?? (pkg.created_at as string | undefined)?.slice(0, 10) ?? "";

    // Package must have started in this payout month
    if (date < periodStart || date >= periodEnd) continue;

    // Deduplication: if multiple is_active=true packages for same client (data
    // integrity violation), keep the one with the latest start_date.
    const existing = packagesByClient[pkg.client_id];
    if (!existing || date > existing.date) {
      packagesByClient[pkg.client_id] = { pkg, date, client };
    }
  }

  const periodEntries = Object.values(packagesByClient);
  if (periodEntries.length === 0) return null;

  // Step 4: Commission rules for this trainer, ordered for deterministic lookup.
  const { data: rules } = await supabase
    .from("trainer_commission_rules")
    .select("id, commission_type, commission_value, effective_from, effective_to, created_at")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  if (!rules || rules.length === 0) return null;

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
          `Using rule ${(applicable[0] as any).id}. Resolve duplicate rules to remove ambiguity.`
      );
    }
    return applicable[0] as any;
  }

  // Step 5: Build per-client breakdown
  const breakdown: ClientBreakdown[] = [];
  let totalRevenue = 0;
  let totalCommission = 0;

  for (const { pkg, date, client } of periodEntries) {
    const amountCollected = Number(pkg.amount_collected ?? 0);
    totalRevenue += amountCollected;

    const rule = findRuleForDate(date);

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
        commission = Number(rule.commission_value);
      }
      totalCommission += commission;
    }

    breakdown.push({
      client_id: client.id,
      first_name: client.first_name ?? "Unknown",
      last_name: client.last_name ?? "",
      package_id: pkg.id,
      package_name: pkg.package_name ?? null,
      package_date: date,
      package_amount: amountCollected,
      sessions_total: pkg.total_sessions ?? null,
      commission_type: commissionType,
      commission_rate: commissionRate,
      commission,
    });
  }

  const primaryRule = findRuleForDate(periodStart) ?? (rules[0] as any);

  return {
    commission_type: primaryRule.commission_type,
    commission_value: Number(primaryRule.commission_value),
    commission_rule_id: primaryRule.id,
    eligible_revenue: Math.round(totalRevenue * 100) / 100,
    package_count: periodEntries.length,
    calculated_payout: Math.round(totalCommission * 100) / 100,
    breakdown,
  };
}
