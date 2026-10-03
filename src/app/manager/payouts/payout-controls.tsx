"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { generatePayoutsForMonth, updatePayoutStatus } from "./actions";
import { Download, RefreshCw } from "lucide-react";

interface Payout {
  id: string;
  status: string;
  trainer_id: string;
  commission_type: string | null;
  commission_value: number | null;
  completed_sessions: number | null;
  eligible_revenue: number | null;
  calculated_payout: number | null;
  adjustments: number | null;
  final_payout: number | null;
  trainers: {
    first_name?: string | null;
    last_name?: string | null;
    profile_picture_url?: string | null;
  } | null;
}

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
}

interface Props {
  payouts: Payout[];
  trainers: Trainer[];
  month: number;
  year: number;
}

const MONTH_NAMES = [
  "Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec",
];

const STATUS_ACTIONS: Record<string, { label: string; next: string; cls: string }> = {
  draft: {
    label: "Mark Reviewed",
    next: "reviewed",
    cls: "text-xs font-medium px-2.5 py-1 rounded-lg border border-[#2E3129] text-[#9B9E96] hover:bg-[#2E3129] hover:text-[#E8EBE4] transition-colors disabled:opacity-50",
  },
  reviewed: {
    label: "Approve",
    next: "approved",
    cls: "text-xs font-medium px-2.5 py-1 rounded-lg border border-[#B9E84A]/40 text-[#B9E84A] hover:bg-[#B9E84A]/10 transition-colors disabled:opacity-50",
  },
  approved: {
    label: "Mark Paid",
    next: "paid",
    cls: "text-xs font-semibold px-2.5 py-1 rounded-lg bg-[#B9E84A] text-[#1A1C18] hover:bg-[#A8D63A] transition-colors disabled:opacity-50",
  },
};

export function PayoutControls({ payouts, month, year }: Props) {
  const [isPending, startTransition] = useTransition();
  const [generateMsg, setGenerateMsg] = useState("");
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [error, setError] = useState("");

  function handleGenerate() {
    setGenerateMsg("");
    setError("");
    startTransition(async () => {
      try {
        const result = await generatePayoutsForMonth(month, year);
        setGenerateMsg(
          `${result.created} created, ${result.updated} updated, ${result.skipped} skipped`
        );
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function handleStatusChange(payoutId: string, next: string) {
    setError("");
    setRowPending(payoutId);
    startTransition(async () => {
      try {
        await updatePayoutStatus(payoutId, next as "reviewed" | "approved" | "paid");
      } catch (e: any) {
        setError(e.message);
      } finally {
        setRowPending(null);
      }
    });
  }

  function downloadCSV() {
    const rows = [
      ["Trainer", "PT Revenue", "PT Commission", "Commission Type", "Adjustments", "Final Payable", "Status"],
      ...payouts.map((p) => [
        `${p.trainers?.first_name ?? ""} ${p.trainers?.last_name ?? ""}`.trim(),
        String(p.eligible_revenue ?? 0),
        String(p.calculated_payout ?? 0),
        p.commission_type === "percentage"
          ? `${p.commission_value}%`
          : `₹${p.commission_value}/package`,
        String(p.adjustments ?? 0),
        String(p.final_payout ?? 0),
        p.status,
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `payouts-${MONTH_NAMES[month - 1]}-${year}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <>
      {/* Action bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={handleGenerate}
            disabled={isPending}
            className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg bg-[#B9E84A] text-[#1A1C18] hover:bg-[#A8D63A] disabled:opacity-60 transition-colors"
          >
            <RefreshCw size={12} className={isPending ? "animate-spin" : ""} />
            {isPending ? "Generating…" : `Generate ${MONTH_NAMES[month - 1]} ${year} Payouts`}
          </button>
          {generateMsg && (
            <span className="text-xs text-[#B9E84A]">{generateMsg}</span>
          )}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>
        {payouts.length > 0 && (
          <button
            onClick={downloadCSV}
            className="inline-flex items-center gap-1.5 text-xs text-[#9B9E96] hover:text-[#E8EBE4] px-3 py-2 rounded-lg border border-[#2E3129] hover:bg-[#222520] transition-colors"
          >
            <Download size={12} /> Export CSV
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[750px]">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {["Trainer", "PT Revenue", "PT Commission", "Adjustments", "Final Payable", "Status", ""].map(
                  (h) => (
                    <th
                      key={h}
                      className="text-left px-5 py-3.5 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide"
                    >
                      {h}
                    </th>
                  )
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1C18]">
              {payouts.map((payout) => {
                const trainer = payout.trainers;
                const action = STATUS_ACTIONS[payout.status];
                const isRowPending = rowPending === payout.id;
                const adj = payout.adjustments ?? 0;

                return (
                  <tr key={payout.id} className="hover:bg-[#1A1C18]/30 transition-colors">
                    <td className="px-5 py-3.5">
                      <Link
                        href={`/manager/payouts/${payout.id}`}
                        className="flex items-center gap-2.5 hover:opacity-80 transition-opacity"
                      >
                        <Avatar
                          firstName={trainer?.first_name ?? "?"}
                          lastName={trainer?.last_name ?? ""}
                          src={trainer?.profile_picture_url ?? null}
                          size="sm"
                        />
                        <span className="text-sm font-medium text-[#E8EBE4]">
                          {trainer?.first_name} {trainer?.last_name}
                        </span>
                      </Link>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-[#E8EBE4] tabular-nums">
                      {formatCurrency(payout.eligible_revenue ?? 0)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="text-sm text-[#E8EBE4] tabular-nums">
                        {formatCurrency(payout.calculated_payout ?? 0)}
                      </div>
                      <div className="text-[10px] text-[#6B6E67]">
                        {payout.commission_type === "percentage"
                          ? `${payout.commission_value}%`
                          : `₹${payout.commission_value}/package`}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm tabular-nums">
                      {adj !== 0 ? (
                        <span className={adj < 0 ? "text-red-400" : "text-[#B9E84A]"}>
                          {adj > 0 ? "+" : ""}
                          {formatCurrency(adj)}
                        </span>
                      ) : (
                        <span className="text-[#4A4D47]">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-bold text-[#E8EBE4] tabular-nums">
                        {formatCurrency(payout.final_payout ?? 0)}
                      </span>
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status={payout.status} />
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2">
                        {action && (
                          <button
                            onClick={() => handleStatusChange(payout.id, action.next)}
                            disabled={isPending}
                            className={action.cls}
                          >
                            {isRowPending ? "…" : action.label}
                          </button>
                        )}
                        <Link
                          href={`/manager/payouts/${payout.id}`}
                          className="text-xs text-[#6B6E67] hover:text-[#E8EBE4] transition-colors whitespace-nowrap"
                        >
                          Details →
                        </Link>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!payouts.length && (
                <tr>
                  <td colSpan={7} className="py-14 text-center text-sm text-[#6B6E67]">
                    No payouts for {MONTH_NAMES[month - 1]} {year}
                    <div className="mt-1 text-xs text-[#4A4D47]">
                      Click &ldquo;Generate&rdquo; above to calculate payouts for active trainers
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
