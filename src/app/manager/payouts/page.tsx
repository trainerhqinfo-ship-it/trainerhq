import { redirect } from "next/navigation";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { formatCurrency } from "@/lib/utils";
import { PayoutControls } from "./payout-controls";

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { month: monthParam, year: yearParam } = await searchParams;

  const now = new Date();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();

  const [{ data: payoutsRaw }, { data: trainersData }] = await Promise.all([
    supabase
      .from("trainer_payouts")
      .select("*, trainers(first_name, last_name, profile_picture_url)")
      .eq("gym_id", gymId)
      .eq("period_month", month)
      .eq("period_year", year)
      .order("status"),
    supabase
      .from("trainers")
      .select("id, first_name, last_name")
      .eq("gym_id", gymId)
      .eq("status", "active"),
  ]);

  const payouts = (payoutsRaw ?? []) as any[];
  const trainers = (trainersData ?? []) as any[];

  // Build last 6 months for selector
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    return { m: d.getMonth() + 1, y: d.getFullYear() };
  }).reverse();

  const totalPayout = payouts.reduce((s, p) => s + (p.final_payout ?? 0), 0);
  const draftCount = payouts.filter((p) => p.status === "draft").length;
  const approvedCount = payouts.filter(
    (p) => p.status === "approved" || p.status === "paid"
  ).length;
  const paidCount = payouts.filter((p) => p.status === "paid").length;

  return (
    <div>
      <Header
        title="Payouts"
        subtitle={`${MONTH_NAMES[month - 1]} ${year}`}
      />

      <div className="px-8 py-6 space-y-5">
        {/* Month selector */}
        <div className="flex items-center gap-1 flex-wrap">
          {months.map(({ m, y }) => {
            const active = m === month && y === year;
            return (
              <a
                key={`${m}-${y}`}
                href={`/manager/payouts?month=${m}&year=${y}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active
                    ? "bg-[#B9E84A] text-[#1A1C18]"
                    : "text-[#6B6E67] hover:bg-[#222520] hover:text-[#E8EBE4]"
                }`}
              >
                {MONTH_NAMES[m - 1]} {y}
              </a>
            );
          })}
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Total Payable", value: formatCurrency(totalPayout) },
            {
              label: "Trainers with Payouts",
              value: `${payouts.length} / ${trainers.length}`,
            },
            { label: "Approved / Paid", value: `${approvedCount}` },
            { label: "Drafts", value: draftCount },
          ].map((card) => (
            <div key={card.label} className="metric-card">
              <div className="text-xl font-bold text-[#E8EBE4] tabular-nums">
                {card.value}
              </div>
              <div className="text-xs text-[#6B6E67] mt-0.5">{card.label}</div>
            </div>
          ))}
        </div>

        {/* Generate + table (client component) */}
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
