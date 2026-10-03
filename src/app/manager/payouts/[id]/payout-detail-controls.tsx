"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import {
  updatePayoutStatus,
  updatePayoutAdjustment,
  updatePayoutDeduction,
} from "../actions";

interface PayoutData {
  id: string;
  status: string;
  period_year: number;
  base_salary: number | null;
  commission_type: string | null;
  commission_value: number | null;
  eligible_revenue: number | null;
  calculated_payout: number | null;
  adjustments: number | null;
  adjustment_notes: string | null;
  deductions: number | null;
  deduction_notes: string | null;
  final_payout: number | null;
}

interface BreakdownRow {
  package_id: string;
  first_name: string;
  last_name: string;
  package_name: string | null;
  sessions_total: number | null;
  package_date: string;
  package_amount: number;
  commission_type: string | null;
  commission_rate: number | null;
  commission: number;
}

interface Props {
  payout: PayoutData;
  breakdown: BreakdownRow[] | null;
  trainerName: string;
  monthName: string;
}

const STATUS_ACTIONS: Record<string, { label: string; next: "reviewed" | "approved" | "paid" }> = {
  draft: { label: "Mark Reviewed", next: "reviewed" },
  reviewed: { label: "Approve", next: "approved" },
  approved: { label: "Mark Paid", next: "paid" },
};

function csvEsc(v: string | number | null | undefined): string {
  return `"${String(v ?? "").replace(/"/g, '""')}"`;
}

function InlineEditor({
  label,
  hint,
  value,
  notes,
  locked,
  onSave,
  isPending,
}: {
  label: string;
  hint?: string;
  value: number;
  notes: string;
  locked: boolean;
  onSave: (val: number, notes: string) => void;
  isPending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [amt, setAmt] = useState(String(value));
  const [note, setNote] = useState(notes);

  if (!editing) {
    return (
      <div className="flex justify-between items-center">
        <span className="text-sm text-[#9B9E96] flex items-center gap-1.5 flex-wrap">
          {label}
          {!locked && (
            <button
              onClick={() => setEditing(true)}
              className="text-[10px] text-[#B9E84A] hover:text-[#A8D63A] underline"
            >
              Edit
            </button>
          )}
          {notes && <span className="text-[#4A4D47] text-xs">({notes})</span>}
          {hint && !notes && <span className="text-[#6B6E67] text-xs">{hint}</span>}
        </span>
        <span
          className={`text-sm tabular-nums ${
            value < 0 ? "text-red-400" : value > 0 ? "text-[#B9E84A]" : "text-[#6B6E67]"
          }`}
        >
          {value !== 0 ? `${value > 0 ? "+" : ""}${formatCurrency(value)}` : "—"}
        </span>
      </div>
    );
  }

  return (
    <div className="bg-[#1A1C18] rounded-xl p-3 space-y-2">
      <div className="text-xs font-medium text-[#9B9E96]">{label}</div>
      <div className="flex gap-2">
        <input
          type="number"
          value={amt}
          onChange={(e) => setAmt(e.target.value)}
          placeholder="e.g. 500"
          className="w-28 px-2 py-1.5 text-xs border border-[#2E3129] rounded-lg bg-[#222520] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
        />
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Reason (optional)"
          className="flex-1 px-2 py-1.5 text-xs border border-[#2E3129] rounded-lg bg-[#222520] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
        />
      </div>
      <div className="flex gap-2">
        <button
          onClick={() => {
            const n = parseFloat(amt);
            if (!isNaN(n)) {
              onSave(n, note);
              setEditing(false);
            }
          }}
          disabled={isPending}
          className="text-xs bg-[#B9E84A] text-[#171917] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60"
        >
          {isPending ? "Saving…" : "Save"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setAmt(String(value));
            setNote(notes);
          }}
          className="text-xs border border-[#2E3129] text-[#9B9E96] px-3 py-1.5 rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

export function PayoutDetailControls({ payout, breakdown, trainerName, monthName }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState("");

  const action = STATUS_ACTIONS[payout.status];
  const locked = payout.status === "paid";

  const baseSalary = Number(payout.base_salary ?? 0);
  const adj = Number(payout.adjustments ?? 0);
  const ded = Number(payout.deductions ?? 0);

  function handleStatusChange() {
    if (!action) return;
    setError("");
    startTransition(async () => {
      try {
        await updatePayoutStatus(payout.id, action.next);
      } catch (e: any) {
        setError(e.message);
      }
    });
  }

  function downloadTrainerPayout() {
    const safeName = trainerName.replace(/\s+/g, "_").replace(/[^A-Za-z0-9_]/g, "");
    const filename = `${safeName}_Payout_${monthName}_${payout.period_year}.csv`;

    const headers = [
      "Month", "Trainer", "Client", "Package",
      "Package Start Date", "Amount Collected",
      "Commission Type", "Commission Rate", "Commission Earned",
      "Base Salary", "Adjustments", "Deductions", "Final Payout", "Status",
    ];

    const rows: string[] = [headers.map(csvEsc).join(",")];

    const base = csvEsc(`${monthName} ${payout.period_year}`);
    const tName = csvEsc(trainerName);
    const bSalary = csvEsc(payout.base_salary ?? 0);
    const adjVal = csvEsc(payout.adjustments ?? 0);
    const dedVal = csvEsc(payout.deductions ?? 0);
    const finalVal = csvEsc(payout.final_payout ?? 0);
    const status = csvEsc(payout.status);

    if (breakdown && breakdown.length > 0) {
      breakdown.forEach((row, idx) => {
        const ruleLabel =
          row.commission_type === "percentage"
            ? `${row.commission_rate}%`
            : row.commission_type === "fixed_per_session"
            ? `₹${row.commission_rate}/package`
            : "No rule";

        rows.push([
          base,
          tName,
          csvEsc(`${row.first_name} ${row.last_name}`),
          csvEsc(row.package_name ?? "—"),
          csvEsc(row.package_date),
          csvEsc(row.package_amount),
          csvEsc(row.commission_type ?? "—"),
          csvEsc(ruleLabel),
          csvEsc(row.commission),
          // Base salary / adj / ded / final only on first row; blank on subsequent
          idx === 0 ? bSalary : csvEsc(""),
          idx === 0 ? adjVal : csvEsc(""),
          idx === 0 ? dedVal : csvEsc(""),
          idx === 0 ? finalVal : csvEsc(""),
          idx === 0 ? status : csvEsc(""),
        ].join(","));
      });
    } else {
      // No packages — single summary row
      rows.push([
        base,
        tName,
        csvEsc("No PT packages this period"),
        csvEsc(""), csvEsc(""), csvEsc(""), csvEsc(""), csvEsc(""), csvEsc(""),
        bSalary, adjVal, dedVal, finalVal, status,
      ].join(","));
    }

    const content = "﻿" + rows.join("\n");
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
    <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5 space-y-4">

      {/* Status + action + download */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <StatusBadge status={payout.status} />
          {locked && (
            <span className="text-xs text-[#6B6E67]">This payroll is locked</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={downloadTrainerPayout}
            className="inline-flex items-center gap-1.5 text-xs text-[#9B9E96] hover:text-[#E8EBE4] px-3 py-2 rounded-lg border border-[#2E3129] hover:bg-[#1A1C18] transition-colors"
          >
            <Download size={12} /> Download Trainer Payout
          </button>
          {action && (
            <button
              onClick={handleStatusChange}
              disabled={isPending}
              className={`text-xs font-semibold px-4 py-2 rounded-lg disabled:opacity-60 transition-colors ${
                action.next === "paid"
                  ? "bg-[#B9E84A] text-[#171917] hover:bg-[#A8D63A]"
                  : action.next === "approved"
                  ? "border border-[#B9E84A]/40 text-[#B9E84A] hover:bg-[#B9E84A]/10"
                  : "border border-[#2E3129] text-[#9B9E96] hover:bg-[#2E3129] hover:text-[#E8EBE4]"
              }`}
            >
              {isPending ? "Updating…" : action.label}
            </button>
          )}
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      {/* Earnings breakdown */}
      <div className="space-y-3 border-t border-[#2E3129] pt-4">

        {/* Base Salary */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#9B9E96]">Base Salary</span>
          <span className="text-sm font-medium text-[#E8EBE4] tabular-nums">
            {baseSalary > 0 ? formatCurrency(baseSalary) : <span className="text-[#6B6E67]">Not set</span>}
          </span>
        </div>

        {/* Attendance payroll placeholder */}
        <div className="flex justify-between items-center opacity-40 pointer-events-none select-none">
          <span className="text-sm text-[#9B9E96]">
            Attendance Deduction
            <span className="ml-1.5 text-[10px] border border-[#2E3129] text-[#6B6E67] rounded px-1 py-0.5">
              coming later
            </span>
          </span>
          <span className="text-sm text-[#6B6E67] tabular-nums">—</span>
        </div>

        <div className="border-t border-[#1A1C18] pt-2" />

        {/* PT Revenue */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#9B9E96]">PT Package Revenue</span>
          <span className="text-sm font-medium text-[#E8EBE4] tabular-nums">
            {formatCurrency(payout.eligible_revenue ?? 0)}
          </span>
        </div>

        {/* PT Commission */}
        <div className="flex justify-between items-center">
          <span className="text-sm text-[#9B9E96]">
            PT Commission{" "}
            <span className="text-[#6B6E67] text-xs">
              ({payout.commission_type === "percentage"
                ? `${payout.commission_value}%`
                : `₹${payout.commission_value}/package`})
            </span>
          </span>
          <span className="text-sm font-medium text-[#E8EBE4] tabular-nums">
            {formatCurrency(payout.calculated_payout ?? 0)}
          </span>
        </div>

        <div className="border-t border-[#1A1C18] pt-2" />

        {/* Adjustments */}
        <InlineEditor
          label="Adjustments"
          hint="(positive = bonus, negative = deduction)"
          value={adj}
          notes={payout.adjustment_notes ?? ""}
          locked={locked}
          isPending={isPending}
          onSave={(val, notes) => {
            setError("");
            startTransition(async () => {
              try {
                await updatePayoutAdjustment(payout.id, val, notes);
              } catch (e: any) {
                setError(e.message);
              }
            });
          }}
        />

        {/* Deductions */}
        <InlineEditor
          label="Deductions"
          hint="(enter as positive amount)"
          value={ded}
          notes={payout.deduction_notes ?? ""}
          locked={locked}
          isPending={isPending}
          onSave={(val, notes) => {
            setError("");
            startTransition(async () => {
              try {
                await updatePayoutDeduction(payout.id, val, notes);
              } catch (e: any) {
                setError(e.message);
              }
            });
          }}
        />
      </div>

      {/* Final Payable */}
      <div className="border-t border-[#2E3129] pt-4 flex justify-between items-center">
        <div>
          <div className="text-base font-semibold text-[#E8EBE4]">Final Payable</div>
          <div className="text-[10px] text-[#6B6E67] mt-0.5">
            Base Salary + PT Commission + Adjustments − Deductions
          </div>
        </div>
        <span className="text-xl font-bold text-[#E8EBE4] tabular-nums">
          {formatCurrency(payout.final_payout ?? 0)}
        </span>
      </div>
    </div>
  );
}
