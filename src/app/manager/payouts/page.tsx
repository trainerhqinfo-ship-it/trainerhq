import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { formatCurrency } from "@/lib/utils";
import { PayoutControls } from "./payout-controls";
import { generatePayoutsForMonth } from "./actions";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

async function fetchPayouts(supabase: any, gymId: string, month: number, year: number) {
  const { data } = await supabase
    .from("trainer_payouts")
    .select("*, trainers(first_name, last_name, profile_picture_url, phone, email)")
    .eq("gym_id", gymId)
    .eq("period_month", month)
    .eq("period_year", year)
    .order("status");
  return (data ?? []) as any[];
}

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { month: monthParam, year: yearParam } = await searchParams;

  const now = new Date();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();

  const prevMonth = month === 1 ? 12 : month - 1;
  const prevYear = month === 1 ? year - 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const nextYear = month === 12 ? year + 1 : year;

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();

  const [payoutsInitial, { data: trainersData }] = await Promise.all([
    fetchPayouts(supabase, gymId, month, year),
    supabase
      .from("trainers")
      .select("id, first_name, last_name")
      .eq("gym_id", gymId)
      .eq("status", "active"),
  ]);

  // Auto-generate/recalculate when:
  //   • No records exist for this month (e.g. fresh month like October), OR
  //   • All existing records are still in draft (stale data from before the
  //     calculation fix — regenerating updates them with the correct algorithm).
  // Records in reviewed/approved/paid status are never touched by generatePayoutsForMonth.
  const allDraftOrEmpty =
    payoutsInitial.length === 0 ||
    payoutsInitial.every((p: any) => p.status === "draft");

  let payouts = payoutsInitial;
  if (allDraftOrEmpty) {
    await generatePayoutsForMonth(month, year);
    payouts = await fetchPayouts(supabase, gymId, month, year);
  }

  const trainers = (trainersData ?? []) as any[];

  const totalPayout = payouts.reduce((s: number, p: any) => s + (p.final_payout ?? 0), 0);
  const draftCount = payouts.filter((p: any) => p.status === "draft").length;
  const approvedCount = payouts.filter(
    (p: any) => p.status === "approved" || p.status === "paid"
  ).length;

  return (
    <div>
      <Header
        title="Payouts"
        subtitle={`${MONTH_NAMES[month - 1]} ${year}`}
      />

      <div className="px-8 py-6 space-y-5">
        {/* Month navigation: ← prev | Month Year | next → */}
        <div className="flex items-center gap-2">
          <Link
            href={`/manager/payouts?month=${prevMonth}&year=${prevYear}`}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#2E3129] text-xs font-medium text-[#9B9E96] hover:bg-[#222520] hover:text-[#E8EBE4] transition-colors"
          >
            <ChevronLeft size={12} /> {MONTH_NAMES[prevMonth - 1]} {prevYear}
          </Link>
          <span className="text-sm font-semibold text-[#E8EBE4] px-4 py-1.5 bg-[#222520] border border-[#2E3129] rounded-lg min-w-[152px] text-center">
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <Link
            href={`/manager/payouts?month=${nextMonth}&year=${nextYear}`}
            className="inline-flex items-center gap-1 h-8 px-3 rounded-lg border border-[#2E3129] text-xs font-medium text-[#9B9E96] hover:bg-[#222520] hover:text-[#E8EBE4] transition-colors"
          >
            {MONTH_NAMES[nextMonth - 1]} {nextYear} <ChevronRight size={12} />
          </Link>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Payable", value: formatCurrency(totalPayout) },
            { label: "Trainers with Payouts", value: `${payouts.length} / ${trainers.length}` },
            { label: "Approved / Paid", value: String(approvedCount) },
            { label: "Drafts", value: String(draftCount) },
          ].map((card) => (
            <div key={card.label} className="metric-card">
              <div className="text-xl font-bold text-[#E8EBE4] tabular-nums">{card.value}</div>
              <div className="text-xs text-[#6B6E67] mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        <PayoutControls
          payouts={payouts}
          trainers={trainers}
          month={month}
          year={year}
        />
      </div>
    </div>
  );
}
