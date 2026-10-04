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
 *   4. The package's start_date falls within the payout period:
 *        - Full month:  [periodStart, periodEnd)  — periodEnd exclusive
 *        - MTD mode:    [periodStart, todayCutoff] — todayCutoff inclusive
 *   5. Each client counted at most once (deduplication guard).
 *
 * Uses three separate queries — no FK joins — because pt_clients, pt_packages,
 * and pt_assignments have no declared FK relationships in the schema.
 *
 * Commission formula:
 *   Fixed:      commission = commission_value  (₹ flat per package)
 *   Percentage: commission = amount_collected × commission_value / 100
 *
 * @param todayCutoff - Optional YYYY-MM-DD string (inclusive upper bound).
 *   Pass today's date for current-month MTD calculations so future-dated
 *   packages are excluded. Omit for full historical months.
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
  // Only status='active'. We join through client_id, not package_id, because
  // neither onboarding nor renewal sets package_id on assignments.
  const { data: assignments } = await supabase
    .from("pt_assignments")
    .select("id, client_id")
    .eq("trainer_id", trainerId)
    .eq("gym_id", gymId)
    .eq("status", "active");

  if (!assignments || assignments.length === 0) return null;

  // Deduplicate client_ids (guard against multiple active assignments per client)
  const clientIds = [
    ...new Set((assignments as any[]).map((a) => a.client_id).filter(Boolean)),
  ];
  if (clientIds.length === 0) return null;

  // ── Query 2: Client info + status (separate query — no FK join available) ──
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

  // ── Query 3: Current active packages for active clients ────────────────────
  // is_active=true means this is the client's non-replaced, current package.
  const { data: packagesRaw } = await supabase
    .from("pt_packages")
    .select("id, client_id, package_name, amount_collected, total_sessions, start_date, end_date, created_at")
    .in("client_id", [...activeClientIds])
    .eq("gym_id", gymId)
    .eq("is_active", true);

  // ── Filter: date gate differs between MTD and full-month modes ──────────
  //
  // MTD mode (todayCutoff provided — current month only):
  //   Include ALL currently active packages (is_active=true) whose start_date
  //   is on or before today. This captures ongoing PT relationships regardless
  //   of when the package was purchased — an August 15 package still active in
  //   October counts for October's payout. Only future-dated packages are excluded.
  //   Lower bound removed intentionally: no "started this month" restriction.
  //
  // Full-month mode (no todayCutoff — historical months):
  //   Commission is earned in the month the package was purchased/started.
  //   start_date must fall in [periodStart, periodEnd). An August package does
  //   NOT count for September; it counted for August when generated then.
  //
  // Fallback: if start_date is null, use created_at date (legacy safety net).
  // Deduplication: one record per client — keep latest start_date.
  const packagesByClient: Record<string, { pkg: any; date: string }> = {};

  for (const pkg of (packagesRaw ?? []) as any[]) {
    if (!activeClientIds.has(pkg.client_id)) continue;

    const date: string =
      pkg.start_date ?? (pkg.created_at as string | undefined)?.slice(0, 10) ?? "";

    if (todayCutoff) {
      // MTD: exclude packages not yet started as of today; no lower-date restriction
      if (date > todayCutoff) continue;
    } else {
      // Full month: package must have started within this specific month
      if (date < periodStart || date >= periodEnd) continue;
    }

    const existing = packagesByClient[pkg.client_id];
    if (!existing || date > existing.date) {
      packagesByClient[pkg.client_id] = { pkg, date };
    }
  }

  const periodEntries = Object.values(packagesByClient);
  if (periodEntries.length === 0) return null;

  // ── Query 4: Commission rules ──────────────────────────────────────────────
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
        // fixed_per_session = fixed per package
        commission = Number(rule.commission_value);
      }
      totalCommission += commission;
    }

    breakdown.push({
      client_id: pkg.client_id,
      first_name: client?.first_name ?? "Unknown",
      last_name: client?.last_name ?? "",
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
