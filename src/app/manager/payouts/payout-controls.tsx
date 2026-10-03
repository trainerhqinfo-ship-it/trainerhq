"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { StatusBadge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import { generatePayoutsForMonth, updatePayoutStatus, getDetailedPayoutsCSV } from "./actions";
import { Download, RefreshCw, Loader2 } from "lucide-react";

interface Payout {
  id: string;
  status: string;
  trainer_id: string;
  commission_type: string | null;
  commission_value: number | null;
  completed_sessions: number | null;
  eligible_revenue: number | null;
  calculated_payout: number | null;
  base_salary: number | null;
  adjustments: number | null;
  deductions: number | null;
  adjustment_notes: string | null;
  deduction_notes: string | null;
  final_payout: number | null;
  trainers: {
    first_name?: string | null;
    last_name?: string | null;
    profile_picture_url?: string | null;
    phone?: string | null;
    email?: string | null;
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
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
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

function commissionRuleLabel(type: string | null, value: number | null): string {
  if (!type || value == null) return "No rule";
  if (type === "percentage") return `${value}%`;
  return `₹${value.toLocaleString("en-IN")}/package`;
}

function escapeCsv(s: string | number | null | undefined): string {
  return `"${String(s ?? "").replace(/"/g, '""')}"`;
}

export function PayoutControls({ payouts, month, year }: Props) {
  const [isPending, startTransition] = useTransition();
  const [generateMsg, setGenerateMsg] = useState("");
  const [rowPending, setRowPending] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [detailedLoading, setDetailedLoading] = useState(false);

  const monthName = MONTH_NAMES[month - 1];

  function handleGenerate() {
    setGenerateMsg("");
    setError("");
    startTransition(async () => {
      try {
        const result = await generatePayoutsForMonth(month, year);
        const parts = [
          result.created > 0 && `${result.created} created`,
          result.updated > 0 && `${result.updated} updated`,
          result.skipped > 0 && `${result.skipped} skipped`,
        ].filter(Boolean);
        setGenerateMsg(
          `${monthName} ${year} payouts generated successfully.${parts.length ? ` (${parts.join(", ")})` : ""}`
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

  // Summary CSV — one row per trainer
  function downloadSummaryCSV() {
    const headers = [
      "Month", "Trainer", "Trainer Phone", "Trainer Email",
      "Commission Rule", "Active PT Clients", "PT Revenue", "PT Commission",
      "Base Salary", "Adjustments", "Deductions", "Final Payout", "Status",
    ];
    const rows = [
      headers.map(escapeCsv).join(","),
      ...payouts.map((p) => [
        escapeCsv(`${monthName} ${year}`),
        escapeCsv(`${p.trainers?.first_name ?? ""} ${p.trainers?.last_name ?? ""}`.trim()),
        escapeCsv(p.trainers?.phone ?? ""),
        escapeCsv(p.trainers?.email ?? ""),
        escapeCsv(commissionRuleLabel(p.commission_type, p.commission_value)),
        escapeCsv(p.completed_sessions ?? 0),
        escapeCsv(p.eligible_revenue ?? 0),
        escapeCsv(p.calculated_payout ?? 0),
        escapeCsv(p.base_salary ?? 0),
        escapeCsv(p.adjustments ?? 0),
        escapeCsv(p.deductions ?? 0),
        escapeCsv(p.final_payout ?? 0),
        escapeCsv(p.status),
      ].join(",")),
    ];
    triggerDownload(
      "﻿" + rows.join("\n"),
      `Payouts_Summary_${monthName}_${year}.csv`
    );
  }

  // Detailed CSV — one row per trainer/package, fetched server-side
  async function downloadDetailedCSV() {
    setDetailedLoading(true);
    setError("");
    try {
      const csv = await getDetailedPayoutsCSV(month, year);
      triggerDownload("﻿" + csv, `Payouts_Detailed_${monthName}_${year}.csv`);
    } catch (e: any) {
      setError(e.message ?? "Failed to generate detailed CSV");
    } finally {
      setDetailedLoading(false);
    }
  }

  function triggerDownload(content: string, filename: string) {
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
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
            {isPending ? "Generating…" : `Generate ${monthName} ${year} Payouts`}
          </button>
          {generateMsg && <span className="text-xs text-[#B9E84A]">{generateMsg}</span>}
          {error && <span className="text-xs text-red-400">{error}</span>}
        </div>

        {payouts.length > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={downloadSummaryCSV}
              className="inline-flex items-center gap-1.5 text-xs text-[#9B9E96] hover:text-[#E8EBE4] px-3 py-2 rounded-lg border border-[#2E3129] hover:bg-[#222520] transition-colors"
            >
              <Download size={12} /> Summary CSV
            </button>
            <button
              onClick={downloadDetailedCSV}
              disabled={detailedLoading}
              className="inline-flex items-center gap-1.5 text-xs text-[#9B9E96] hover:text-[#E8EBE4] px-3 py-2 rounded-lg border border-[#2E3129] hover:bg-[#222520] transition-colors disabled:opacity-60"
            >
              {detailedLoading ? (
                <><Loader2 size={12} className="animate-spin" /> Preparing…</>
              ) : (
                <><Download size={12} /> Detailed CSV</>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px]">
            <thead>
              <tr className="border-b border-[#1A1C18]">
                {[
                  "Trainer",
                  "Commission Rule",
                  "Active PT Clients",
                  "PT Revenue",
                  "PT Commission",
                  "Base Salary",
                  "Adjustments",
                  "Deductions",
                  "Final Payout",
                  "Status",
                  "",
                ].map((h) => (
                  <th
                    key={h}
                    className="text-left px-4 py-3.5 text-[11px] font-semibold text-[#6B6E67] uppercase tracking-wide whitespace-nowrap"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1C18]">
              {payouts.map((payout) => {
                const trainer = payout.trainers;
                const action = STATUS_ACTIONS[payout.status];
                const isRowPending = rowPending === payout.id;
                const adj = payout.adjustments ?? 0;
                const ded = payout.deductions ?? 0;
                const base = payout.base_salary ?? 0;
                const ruleLabel = commissionRuleLabel(payout.commission_type, payout.commission_value);

                return (
                  <tr key={payout.id} className="hover:bg-[#1A1C18]/30 transition-colors">
                    {/* Trainer */}
                    <td className="px-4 py-3.5">
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

                    {/* Commission Rule */}
                    <td className="px-4 py-3.5">
                      <span className={`text-xs font-medium px-2 py-1 rounded-lg border ${
                        ruleLabel === "No rule"
                          ? "text-red-400 border-red-500/20 bg-red-500/5"
                          : "text-[#B9E84A] border-[#B9E84A]/20 bg-[#B9E84A]/5"
                      }`}>
                        {ruleLabel}
                      </span>
                    </td>

                    {/* PT Packages */}
                    <td className="px-4 py-3.5 text-sm text-[#E8EBE4] tabular-nums text-center">
                      {payout.completed_sessions ?? 0}
                    </td>

                    {/* PT Revenue */}
                    <td className="px-4 py-3.5 text-sm text-[#E8EBE4] tabular-nums">
                      {formatCurrency(payout.eligible_revenue ?? 0)}
                    </td>

                    {/* PT Commission */}
                    <td className="px-4 py-3.5 text-sm font-medium text-[#E8EBE4] tabular-nums">
                      {formatCurrency(payout.calculated_payout ?? 0)}
                    </td>

                    {/* Base Salary */}
                    <td className="px-4 py-3.5 text-sm text-[#9B9E96] tabular-nums">
                      {base > 0 ? formatCurrency(base) : <span className="text-[#4A4D47]">—</span>}
                    </td>

                    {/* Adjustments */}
                    <td className="px-4 py-3.5 text-sm tabular-nums">
                      {adj !== 0 ? (
                        <span className={adj < 0 ? "text-red-400" : "text-[#B9E84A]"}>
                          {adj > 0 ? "+" : ""}{formatCurrency(adj)}
                        </span>
                      ) : (
                        <span className="text-[#4A4D47]">—</span>
                      )}
                    </td>

                    {/* Deductions */}
                    <td className="px-4 py-3.5 text-sm tabular-nums">
                      {ded > 0 ? (
                        <span className="text-red-400">−{formatCurrency(ded)}</span>
                      ) : (
                        <span className="text-[#4A4D47]">—</span>
                      )}
                    </td>

                    {/* Final Payout */}
                    <td className="px-4 py-3.5">
                      <span className="text-sm font-bold text-[#E8EBE4] tabular-nums">
                        {formatCurrency(payout.final_payout ?? 0)}
                      </span>
                    </td>

                    {/* Status */}
                    <td className="px-4 py-3.5">
                      <StatusBadge status={payout.status} />
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3.5">
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
                  <td colSpan={11} className="py-14 text-center text-sm text-[#6B6E67]">
                    No payouts for {monthName} {year}
                    <div className="mt-1 text-xs text-[#4A4D47]">
                      Click "Generate" above to calculate payouts for active trainers
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
