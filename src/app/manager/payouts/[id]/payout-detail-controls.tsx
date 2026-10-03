"use client";

import { useState, useTransition } from "react";
import { formatCurrency } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/badge";
import {
  updatePayoutStatus,
  updatePayoutAdjustment,
  updatePayoutDeduction,
} from "../actions";

interface PayoutData {
  id: string;
  status: string;
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

interface Props {
  payout: PayoutData;
}

const STATUS_ACTIONS: Record<string, { label: string; next: "reviewed" | "approved" | "paid" }> = {
  draft: { label: "Mark Reviewed", next: "reviewed" },
  reviewed: { label: "Approve", next: "approved" },
  approved: { label: "Mark Paid", next: "paid" },
};

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

export function PayoutDetailControls({ payout }: Props) {
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

  return (
    <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5 space-y-4">

      {/* Status + action */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2.5">
          <StatusBadge status={payout.status} />
          {locked && (
            <span className="text-xs text-[#6B6E67]">This payroll is locked</span>
          )}
        </div>
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
