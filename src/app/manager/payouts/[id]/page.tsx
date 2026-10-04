import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient, getProfile } from "@/lib/supabase/server";
import { Header } from "@/components/layout/header";
import { Avatar } from "@/components/ui/avatar";
import { formatCurrency } from "@/lib/utils";
import { calculatePayoutForTrainer } from "@/lib/payout-utils";
import { PayoutDetailControls } from "./payout-detail-controls";
import { ArrowLeft, Phone, Mail } from "lucide-react";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function fmtDate(d: string) {
  return new Date(d + "T00:00:00").toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export default async function PayoutDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getProfile();
  if (!profile) redirect("/login");
  const { gymId } = profile;

  const supabase = await createClient();
  if (!gymId) redirect("/login");

  const { data: payoutRaw } = await supabase
    .from("trainer_payouts")
    .select("*, trainers(first_name, last_name, profile_picture_url, role_title, phone, email)")
    .eq("id", id)
    .eq("gym_id", gymId)
    .single();

  if (!payoutRaw) notFound();

  const payout = payoutRaw as any;
  const trainer = payout.trainers;
  const monthName = MONTH_NAMES[payout.period_month - 1];
  const trainerFullName = `${trainer?.first_name ?? ""} ${trainer?.last_name ?? ""}`.trim();

  // For the current month, cap package dates at today so future packages aren't counted.
  const nowUtc = new Date();
  const isCurrentMonth =
    payout.period_month === nowUtc.getUTCMonth() + 1 &&
    payout.period_year === nowUtc.getUTCFullYear();
  const todayCutoff = isCurrentMonth ? nowUtc.toISOString().slice(0, 10) : undefined;

  const breakdown = await calculatePayoutForTrainer(
    supabase,
    payout.trainer_id,
    gymId,
    payout.period_month,
    payout.period_year,
    todayCutoff
  );

  return (
    <div>
      <Header
        title={trainerFullName || "Trainer"}
        subtitle={`Payout · ${monthName} ${payout.period_year}`}
        actions={
          <Link
            href={`/manager/payouts?month=${payout.period_month}&year=${payout.period_year}`}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#2E3129] text-xs font-medium text-[#9B9E96] hover:bg-[#1A1C18] hover:text-[#E8EBE4] transition-colors"
          >
            <ArrowLeft size={12} /> All Payouts
          </Link>
        }
      />

      <div className="px-8 py-6 space-y-5">
        {/* Trainer card */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
          <div className="flex items-center gap-4 flex-wrap">
            <Avatar
              firstName={trainer?.first_name ?? "?"}
              lastName={trainer?.last_name ?? ""}
              src={trainer?.profile_picture_url ?? null}
              size="lg"
            />
            <div className="flex-1 min-w-0">
              <h2 className="text-base font-semibold text-[#E8EBE4]">
                {trainer?.first_name} {trainer?.last_name}
              </h2>
              {trainer?.role_title && (
                <p className="text-sm text-[#9B9E96]">{trainer.role_title}</p>
              )}
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
                {trainer?.phone && (
                  <span className="flex items-center gap-1 text-xs text-[#6B6E67]">
                    <Phone size={10} /> {trainer.phone}
                  </span>
                )}
                {trainer?.email && (
                  <span className="flex items-center gap-1 text-xs text-[#6B6E67]">
                    <Mail size={10} /> {trainer.email}
                  </span>
                )}
                <span className="text-xs text-[#6B6E67]">
                  {monthName} {payout.period_year}
                  {" · "}
                  {payout.commission_type === "percentage"
                    ? `${payout.commission_value}% of package value`
                    : `₹${payout.commission_value} fixed per package`}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status + earnings (client component) */}
        <PayoutDetailControls
          payout={payout}
          breakdown={breakdown?.breakdown ?? null}
          trainerName={trainerFullName}
          monthName={monthName}
        />

        {/* Commission breakdown table */}
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#2E3129]">
            <h3 className="text-sm font-semibold text-[#E8EBE4]">Commission Breakdown</h3>
            <p className="text-xs text-[#6B6E67] mt-0.5">
              {breakdown
                ? isCurrentMonth
                  ? `${breakdown.breakdown.length} active PT client${breakdown.breakdown.length !== 1 ? "s" : ""} with active packages as of ${todayCutoff} (month-to-date)`
                  : `${breakdown.breakdown.length} active PT client${breakdown.breakdown.length !== 1 ? "s" : ""} with packages starting in ${monthName} ${payout.period_year}`
                : "No active PT clients with qualifying packages this period, or no commission rule configured"}
            </p>
          </div>

          {breakdown && breakdown.breakdown.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px]">
                <thead>
                  <tr className="border-b border-[#1A1C18]">
                    {["Client","Package","Date","Paid","Duration","Monthly Value","Source / Rule","Commission"].map((h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1A1C18]">
                  {breakdown.breakdown.map((row) => {
                    const r = row as any;
                    return (
                      <tr key={row.package_id} className="hover:bg-[#1A1C18]/50 transition-colors">
                        <td className="px-4 py-3 text-sm font-medium text-[#E8EBE4]">
                          {row.first_name} {row.last_name}
                        </td>
                        <td className="px-4 py-3">
                          <div className="text-sm text-[#E8EBE4]">{row.package_name ?? "—"}</div>
                          {row.sessions_total != null && (
                            <div className="text-[10px] text-[#6B6E67] mt-0.5">
                              {row.sessions_total} sessions
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#9B9E96] tabular-nums whitespace-nowrap">
                          <div>{fmtDate(row.package_date)}</div>
                          {r.package_end_date && (
                            <div className="text-[10px] text-[#4A4D47]">→ {fmtDate(r.package_end_date)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-[#E8EBE4] tabular-nums">
                          {formatCurrency(row.package_amount)}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#9B9E96] tabular-nums">
                          {r.duration_months != null && r.duration_months > 1
                            ? <span>{r.duration_months} mo</span>
                            : <span className="text-[#4A4D47]">1 mo</span>}
                        </td>
                        <td className="px-4 py-3 text-sm text-[#9B9E96] tabular-nums">
                          {r.monthly_package_value != null && r.duration_months > 1
                            ? <span>{formatCurrency(r.monthly_package_value)}/mo</span>
                            : <span className="text-[#4A4D47]">—</span>}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {r.commission_source === "package" ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#B9E84A]/10 text-[#B9E84A] border border-[#B9E84A]/20">PKG</span>
                            ) : r.commission_source === "trainer_default" ? (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-[#2E3129] text-[#9B9E96] border border-[#2E3129]">DEFAULT</span>
                            ) : (
                              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-400 border border-orange-500/20">NONE</span>
                            )}
                          </div>
                          <div className="text-xs text-[#9B9E96] mt-0.5">
                            {row.commission_type === null ? (
                              <span className="text-red-400">No rule</span>
                            ) : row.commission_type === "percentage" ? (
                              <span>{row.commission_rate}%</span>
                            ) : (
                              <span>₹{row.commission_rate?.toLocaleString("en-IN")}/mo</span>
                            )}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-[#B9E84A] tabular-nums">
                          {row.commission > 0
                            ? formatCurrency(row.commission)
                            : <span className="text-[#6B6E67]">—</span>}
                          {row.commission > 0 && (
                            <div className="text-[10px] text-[#6B6E67] font-normal">/mo</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}

                  {/* Totals row */}
                  <tr className="bg-[#1A1C18] border-t-2 border-[#2E3129]">
                    <td
                      className="px-4 py-3 text-xs font-semibold text-[#6B6E67] uppercase tracking-wide"
                      colSpan={3}
                    >
                      Total ({breakdown.package_count} active client{breakdown.package_count !== 1 ? "s" : ""})
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-[#E8EBE4] tabular-nums">
                      {formatCurrency(breakdown.eligible_revenue)}
                    </td>
                    <td colSpan={2} />
                    <td />
                    <td className="px-4 py-3 text-sm font-bold text-[#B9E84A] tabular-nums">
                      {formatCurrency(breakdown.calculated_payout)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          ) : (
            <div className="px-5 py-10 text-center text-sm text-[#6B6E67]">
              {breakdown
                ? "No packages with a start_date in this period"
                : "No commission rule found — set a commission rule for this trainer first"}
            </div>
          )}
        </div>

        {/* Trainer profile link */}
        <div className="flex justify-end">
          <Link
            href={`/manager/trainers/${payout.trainer_id}`}
            className="text-xs text-[#6B6E67] hover:text-[#E8EBE4] transition-colors"
          >
            View trainer profile →
          </Link>
        </div>
      </div>
    </div>
  );
}
