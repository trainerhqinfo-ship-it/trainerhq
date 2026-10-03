"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recalculatePayoutForTrainer } from "@/app/manager/payouts/actions";
import { formatCurrency } from "@/lib/utils";

interface Props {
  trainerId: string;
  gymId: string;
  baseSalary: number;
}

export function BaseSalaryEditor({ trainerId, gymId, baseSalary }: Props) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(baseSalary > 0 ? baseSalary : ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const displayText = baseSalary > 0 ? formatCurrency(baseSalary) + "/month" : "Not set";

  const handleSave = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num < 0) {
      setError("Enter a valid salary (0 to disable)");
      return;
    }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from("trainers")
      .update({ base_salary: num } as any)
      .eq("id", trainerId)
      .eq("gym_id", gymId);

    if (updateErr) {
      setError(updateErr.message);
      setSaving(false);
      return;
    }

    // Recalculate current month payroll so the payout card reflects the new salary
    const now = new Date();
    await recalculatePayoutForTrainer(trainerId, gymId, now.getMonth() + 1, now.getFullYear());

    setSaving(false);
    window.location.reload();
  };

  if (!editing) {
    return (
      <div>
        <div className="text-xs text-[#9B9E96]">Base Salary</div>
        <div className="flex items-center gap-2 mt-0.5">
          <div className="font-medium text-[#E8EBE4]">{displayText}</div>
          <button
            onClick={() => setEditing(true)}
            className="text-[10px] text-[#B9E84A] hover:text-[#A8D63A] underline"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="col-span-2 bg-[#1A1C18] rounded-xl p-3 space-y-3">
      <div className="text-xs font-medium text-[#9B9E96]">Base Monthly Salary</div>
      <div className="relative w-40">
        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9B9E96]">₹</span>
        <input
          type="number"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="25000"
          min="0"
          className="w-full pl-6 pr-2 py-1.5 text-xs border border-[#2E3129] rounded-lg bg-[#222520] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
        />
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="text-xs bg-[#B9E84A] text-[#171917] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 hover:bg-[#A8D63A]"
        >
          {saving ? "Saving…" : "Save & Recalculate"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setError("");
            setValue(String(baseSalary > 0 ? baseSalary : ""));
          }}
          className="text-xs border border-[#2E3129] text-[#9B9E96] px-3 py-1.5 rounded-lg hover:bg-[#2E3129]"
        >
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-[#6B6E67]">
        Attendance deduction: (absent days / expected working days) × base salary
      </p>
    </div>
  );
}
