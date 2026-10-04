import type { SupabaseClient } from "@supabase/supabase-js";

export function getMonthPeriod(month: number, year: number) {
  const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;
  const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;
  return { periodStart, periodEnd };
}

/**
 * Count calendar months a package spans.
 * Examples: Oct→Dec = 3; Oct→Mar(next year) = 6; Oct→Oct = 1.
 * Uses the year+month of start and end dates only (day-of-month ignored).
 */
export function calcDurationMonths(startDate: string, endDate: string | null | undefined): number {
  if (!endDate) return 1;
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = endDate.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

export interface ClientBreakdown {
  client_id: string;
  first_name: string;
  last_name: string;
  package_id: string;
  package_name: string | null;
  /** package.start_date — when the package was bought/started */
  package_date: string;
  package_end_date: string | null;
  /** pt_packages.amount_collected — total amount paid for the whole package */
  package_amount: number;
  /** Calendar months the package spans (1 if no end_date) */
  duration_months: number;
  /** amount_collected / duration_months — monthly basis for percentage commission */
  monthly_package_value: number;
  /** sessions purchased (informational only, does not determine commission) */
  sessions_total: number | null;
  commission_type: string | null;
  commission_rate: number | null;
  /** Whether the rule came from the package itself or trainer-level fallback */
  commission_source: "package" | "trainer_default";
  /** Monthly commission earned for this client */
  commission: number;
}

export interface PayoutCalc {
  /** Summary type — primary trainer rule if exists, else first package rule */
  commission_type: string;
  commission_value: number;
  commission_rule_id: string | null;
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
 * Commission priority per client:
 *   1. pt_packages.trainer_payout_type / trainer_payout_value  (package-level, explicit)
 *   2. trainer_commission_rules  (trainer-wide fallback for legacy packages without package rule)
 *
 * Monthly commission formula (package-level rules only):
 *   duration_months    = calendar months from start_date to end_date (1 if no end_date)
 *   monthly_pkg_value  = amount_collected / duration_months
 *   fixed_monthly:     commission = trainer_payout_value  (flat ₹/month)
 *   percentage:        commission = monthly_pkg_value × trainer_payout_value / 100
 *
 * Legacy trainer-rule fallback (backward compat, unchanged):
 *   percentage:  commission = amount_collected × commission_value / 100  (full package amount)
 *   fixed:       commission = commission_value  (flat per package)
 *
 * @param todayCutoff - Optional YYYY-MM-DD (inclusive). Pass for current-month MTD.
 */
export async function calculatePayoutForTrainer(
  supabase: SupabaseClient<any>,
  trainerId: string,
  gymId: string,
  month: number,
  year: number,
  todayCutoff?: string
): Promise<PayoutCalc | null> {
  const { periodStart, periodEnd } = getMonthPeriod(month, year);

  // ── Query 1: Trainer's ACTIVE assignments ──────────────────────────────────
  const { data: assignments } = await supabase
    .from("pt_assignments")
    .select("id, client_id")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .eq("status", "active");

  if (!assignments || assignments.length === 0) return null;

  const clientIds = [
    ...new Set((assignments as any[]).map((a) => a.client_id).filter(Boolean)),
  ];
  if (clientIds.length === 0) return null;

  // ── Query 2: Client info + status ──────────────────────────────────────────
  const { data: clientsRaw } = await supabase
    .from("pt_clients")
    .select("id, first_name, last_name, status")
    .in("id", clientIds)
    .eq("gym_id", gymId);

  const clientMap: Record<string, any> = {};
  const activeClientIds = new Set<string>();
  for (const c of (clientsRaw ?? []) as any[]) {
    clientMap[c.id] = c;
    if (c.status === "active") activeClientIds.add(c.id);
  }

  if (activeClientIds.size === 0) return null;

  // ── Query 3: Active packages — includes package-level commission fields ─────
  const { data: packagesRaw } = await supabase
    .from("pt_packages")
    .select("id, client_id, package_name, amount_collected, total_sessions, start_date, end_date, created_at, trainer_payout_type, trainer_payout_value")
    .in("client_id", [...activeClientIds])
    .eq("gym_id", gymId)
    .eq("is_active", true);

  // ── Date gate (MTD vs full-month) — unchanged ──────────────────────────────
  //
  // MTD: ALL active packages with start_date <= today count (no lower bound).
  //      Expired packages (end_date < today) are excluded.
  // Historical: start_date must fall in [periodStart, periodEnd).
  const packagesByClient: Record<string, { pkg: any; date: string }> = {};

  for (const pkg of (packagesRaw ?? []) as any[]) {
    if (!activeClientIds.has(pkg.client_id)) continue;

    const date: string =
      pkg.start_date ?? (pkg.created_at as string | undefined)?.slice(0, 10) ?? "";

    if (todayCutoff) {
      if (date > todayCutoff) continue;
      if (pkg.end_date && pkg.end_date < todayCutoff) continue;
    } else {
      if (date < periodStart || date >= periodEnd) continue;
    }

    const existing = packagesByClient[pkg.client_id];
    if (!existing || date > existing.date) {
      packagesByClient[pkg.client_id] = { pkg, date };
    }
  }

  const periodEntries = Object.values(packagesByClient);
  if (periodEntries.length === 0) return null;

  // ── Query 4: Trainer-level commission rules (fallback for legacy packages) ──
  // Not null-guarded: package-level rules may cover all clients without trainer rules.
  const { data: rules } = await supabase
    .from("trainer_commission_rules")
    .select("id, commission_type, commission_value, effective_from, effective_to, created_at")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .order("effective_from", { ascending: false })
    .order("created_at", { ascending: false })
    .order("id", { ascending: false });

  function findRuleForDate(packageDate: string) {
    const applicable = (rules ?? []).filter(
      (r: any) =>
        r.effective_from <= packageDate &&
        (r.effective_to === null || r.effective_to >= packageDate)
    );
    if (applicable.length === 0) return null;
    if (applicable.length > 1) {
      console.warn(
        `[payout-utils] trainer ${trainerId} has ${applicable.length} overlapping commission rules for date ${packageDate}. ` +
          `Using rule ${(applicable[0] as any).id}. Resolve duplicates to remove ambiguity.`
      );
    }
    return applicable[0] as any;
  }

  // ── Build per-client breakdown ─────────────────────────────────────────────
  const breakdown: ClientBreakdown[] = [];
  let totalRevenue = 0;
  let totalCommission = 0;

  for (const { pkg, date } of periodEntries) {
    const client = clientMap[pkg.client_id];
    const amountCollected = Number(pkg.amount_collected ?? 0);
    totalRevenue += amountCollected;

    const durationMonths = calcDurationMonths(date, pkg.end_date);
    const monthlyPackageValue = Math.round((amountCollected / durationMonths) * 100) / 100;

    // Package-level rule takes priority; fall back to trainer rule for legacy packages
    const hasPackageRule =
      pkg.trainer_payout_type != null && pkg.trainer_payout_value != null;
    const trainerRule = hasPackageRule ? null : findRuleForDate(date);

    let commission = 0;
    let commissionType: string | null = null;
    let commissionRate: number | null = null;
    let commissionSource: "package" | "trainer_default" = "trainer_default";

    if (hasPackageRule) {
      // ── New package-level rule: monthly commission ───────────────────────
      commissionSource = "package";
      commissionType = pkg.trainer_payout_type;
      commissionRate = Number(pkg.trainer_payout_value);

      if (pkg.trainer_payout_type === "percentage") {
        commission = Math.round((monthlyPackageValue * commissionRate) / 100 * 100) / 100;
      } else {
        // fixed_monthly: flat ₹ regardless of package amount/duration
        commission = commissionRate;
      }
    } else if (trainerRule) {
      // ── Legacy trainer rule: preserve original per-package calculation ───
      commissionSource = "trainer_default";
      commissionType = trainerRule.commission_type;
      commissionRate = Number(trainerRule.commission_value);

      if (trainerRule.commission_type === "percentage") {
        // Unchanged: percentage of full amount_collected (not monthly value)
        commission = Math.round((amountCollected * commissionRate) / 100 * 100) / 100;
      } else {
        // fixed_per_session = fixed per package (legacy label, means per package)
        commission = commissionRate;
      }
    }

    totalCommission += commission;

    breakdown.push({
      client_id: pkg.client_id,
      first_name: client?.first_name ?? "Unknown",
      last_name: client?.last_name ?? "",
      package_id: pkg.id,
      package_name: pkg.package_name ?? null,
      package_date: date,
      package_end_date: pkg.end_date ?? null,
      package_amount: amountCollected,
      duration_months: durationMonths,
      monthly_package_value: monthlyPackageValue,
      sessions_total: pkg.total_sessions ?? null,
      commission_type: commissionType,
      commission_rate: commissionRate,
      commission_source: commissionSource,
      commission,
    });
  }

  // ── Summary fields for trainer_payouts record (backward compat) ────────────
  const primaryTrainerRule =
    findRuleForDate(periodStart) ?? ((rules ?? [])[0] as any ?? null);
  const firstEntry = breakdown[0];
  const summaryType =
    primaryTrainerRule?.commission_type ?? firstEntry?.commission_type ?? "fixed_monthly";
  const summaryValue = primaryTrainerRule
    ? Number(primaryTrainerRule.commission_value)
    : (firstEntry?.commission_rate ?? 0);
  const summaryRuleId = primaryTrainerRule?.id ?? null;

  return {
    commission_type: summaryType,
    commission_value: summaryValue,
    commission_rule_id: summaryRuleId,
    eligible_revenue: Math.round(totalRevenue * 100) / 100,
    package_count: periodEntries.length,
    calculated_payout: Math.round(totalCommission * 100) / 100,
    breakdown,
  };
}
