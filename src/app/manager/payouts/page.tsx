import { redirect } from "next/navigation";
import { createClient, getSessionUser } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const { month: monthParam, year: yearParam } = await searchParams;

  const now = new Date();
  const month = monthParam ? parseInt(monthParam) : now.getMonth() + 1;
  const year = yearParam ? parseInt(yearParam) : now.getFullYear();

  const user = await getSessionUser();
  if (!user) redirect("/login");

  const supabase = await createClient();
  const { data: profile } = await supabase.from("profiles").select("gym_id").eq("id", user.id).single();
  const gymId = profile?.gym_id;
  if (!gymId) redirect("/login");

  const [{ data: payoutsRaw }, { data: trainersData }] = await Promise.all([
    supabase.from("trainer_payouts")
      .select("*, trainers(first_name, last_name, profile_picture_url)")
      .eq("gym_id", gymId)
      .eq("period_month", month)
      .eq("period_year", year),
    supabase.from("trainers").select("*").eq("gym_id", gymId).eq("status", "active"),
  ]);

  const payouts = payoutsRaw ?? [];
  const trainers = trainersData ?? [];

  const totalPayout = payouts.reduce((s: number, p: any) => s + (p.final_payout ?? 0), 0);
  const approvedCount = payouts.filter((p: any) => p.status === "approved" || p.status === "paid").length;

  return (
    <div>
      <Header title="Payouts" subtitle={`${MONTH_NAMES[month - 1]} ${year}`} />

      <div className="px-8 py-6 space-y-5">
        {/* Month selector */}
        <div className="flex items-center gap-2">
          {[-2,-1,0].map(delta => {
            const d = new Date(year, month - 1 + delta, 1);
            const m = d.getMonth() + 1;
            const y = d.getFullYear();
            const active = m === month && y === year;
            return (
              <a
                key={delta}
                href={`/manager/payouts?month=${m}&year=${y}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  active ? "bg-[#B9E84A] text-[#1A1C18]" : "text-[#6B6E67] hover:bg-[#222520]"
                }`}
              >
                {MONTH_NAMES[d.getMonth()]} {y}
              </a>
            );
          })}
        </div>

        {/* Summary */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total Payout", value: formatCurrency(totalPayout) },
            { label: "Trainers with Payouts", value: `${payouts.length}/${trainers.length}` },
            { label: "Approved", value: `${approvedCount}/${payouts.length}` },
          ].map(m => (
            <div key={m.label} className="metric-card">
              <div className="text-xl font-bold text-[#E8EBE4]">{m.value}</div>
              <div className="text-xs text-[#6B6E67] mt-0.5">{m.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {["Trainer", "Commission", "Clients", "Revenue", "Calc. Payout", "Final Payout", "Status", ""].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-[11px] font-medium text-[#6B6E67]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {payouts.map((payout: any) => {
                const trainer = payout.trainers;
                return (
                  <tr key={payout.id} className="border-b border-[#1A1C18] table-row-hover">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <Avatar firstName={trainer?.first_name ?? "?"} lastName={trainer?.last_name ?? ""} src={trainer?.profile_picture_url} size="sm" />
                        <span className="text-sm font-medium text-[#E8EBE4]">{trainer?.first_name} {trainer?.last_name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#6B6E67]">
                      {payout.commission_type === "percentage"
                        ? `${payout.commission_value}%`
                        : `₹${payout.commission_value}/client`}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#E8EBE4]">{payout.completed_sessions}</td>
                    <td className="px-5 py-3.5 text-sm text-[#E8EBE4]">{formatCurrency(payout.eligible_revenue)}</td>
                    <td className="px-5 py-3.5 text-sm text-[#E8EBE4]">{formatCurrency(payout.calculated_payout)}</td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-bold text-[#E8EBE4]">{formatCurrency(payout.final_payout)}</span>
                    </td>
                    <td className="px-5 py-3.5"><StatusBadge status={payout.status} /></td>
                    <td className="px-5 py-3.5">
                      {payout.status === "draft" && (
                        <button className="text-xs text-[#6B6E67] hover:text-[#E8EBE4]">Approve →</button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!payouts.length && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-sm text-[#6B6E67]">
                    No payouts for {MONTH_NAMES[month - 1]} {year}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
