"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { recalculatePayoutForTrainer } from "@/app/manager/payouts/actions";

interface Props {
  trainerId: string;
  gymId: string;
  commissionType: string | null;
  commissionValue: number | null;
  commissionRuleId: string | null;
}

/** Returns YYYY-MM-DD for a date offset by `days` from today (IST). */
function isoDateOffset(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}

export function CommissionEditor({
  trainerId,
  gymId,
  commissionType,
  commissionValue,
  commissionRuleId,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState(commissionType ?? "fixed_per_session");
  const [value, setValue] = useState(String(commissionValue ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const displayText = commissionType
    ? commissionType === "percentage"
      ? `${commissionValue}% of package value`
      : `₹${(commissionValue ?? 0).toLocaleString("en-IN")}/package`
    : "Not set";

  const handleSave = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const today = isoDateOffset(0);
    const yesterday = isoDateOffset(-1);
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // Fetch all open rules for this trainer (effective_to IS NULL)
    const { data: openRules } = await supabase
      .from("trainer_commission_rules")
      .select("id, effective_from, commission_type, commission_value")
      .eq("trainer_id", trainerId)
      .eq("gym_id", gymId)
      .is("effective_to", null);

    const existingOpenRules = openRules ?? [];

    // Check if there is already an open rule starting TODAY (same-date case)
    const sameDayRule = existingOpenRules.find((r: any) => r.effective_from === today);

    if (sameDayRule) {
      // Same-date replacement: UPDATE the existing rule rather than close+create.
      // This avoids two competing rules for the same effective_from date.
      const { error: updateErr } = await supabase
        .from("trainer_commission_rules")
        .update({
          commission_type: type as "percentage" | "fixed_per_session",
          commission_value: num,
        })
        .eq("id", sameDayRule.id);

      if (updateErr) {
        setError(updateErr.message);
        setSaving(false);
        return;
      }

      // Close any OTHER open rules that started before today (shouldn't exist, but clean up)
      const olderRules = existingOpenRules.filter(
        (r: any) => r.id !== sameDayRule.id && r.effective_from < today
      );
      for (const old of olderRules) {
        await supabase
          .from("trainer_commission_rules")
          .update({ effective_to: yesterday })
          .eq("id", old.id);
      }
    } else {
      // Normal case: close all existing open rules with effective_to = yesterday
      // (day before the new rule's effective_from = today).
      // This ensures: old rule covers [effective_from … yesterday], new covers [today … open].
      for (const old of existingOpenRules) {
        const closeDate = old.effective_from < today ? yesterday : today;
        await supabase
          .from("trainer_commission_rules")
          .update({ effective_to: closeDate })
          .eq("id", old.id);
      }

      // Insert the new rule starting today
      const { error: insertErr } = await supabase
        .from("trainer_commission_rules")
        .insert({
          trainer_id: trainerId,
          gym_id: gymId,
          commission_type: type as "percentage" | "fixed_per_session",
          commission_value: num,
          effective_from: today,
        });

      if (insertErr) {
        setError(insertErr.message);
        setSaving(false);
        return;
      }
    }

    // Recalculate current month payout using the single authoritative calculation path
    await recalculatePayoutForTrainer(trainerId, gymId, month, year);

    setSaving(false);
    window.location.reload();
  };

  if (!editing) {
    return (
      <div>
        <div className="text-xs text-[#9B9E96]">Commission</div>
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
      <div className="text-xs font-medium text-[#9B9E96]">Edit Commission</div>
      <div className="flex gap-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="flex-1 text-xs border border-[#2E3129] rounded-lg px-2 py-1.5 bg-[#222520] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
        >
          <option value="fixed_per_session">Fixed per package (₹)</option>
          <option value="percentage">Percentage of package value (%)</option>
        </select>
        <div className="relative w-28">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9B9E96]">
            {type === "percentage" ? "%" : "₹"}
          </span>
          <input
            type="number"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "percentage" ? "25" : "1500"}
            min="1"
            className="w-full pl-6 pr-2 py-1.5 text-xs border border-[#2E3129] rounded-lg bg-[#222520] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
          />
        </div>
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
            setValue(String(commissionValue ?? ""));
            setType(commissionType ?? "fixed_per_session");
          }}
          className="text-xs border border-[#2E3129] text-[#9B9E96] px-3 py-1.5 rounded-lg hover:bg-[#2E3129]"
        >
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-[#6B6E67]">
        Existing rule closes yesterday · new rule starts today · payout recalculated
      </p>
    </div>
  );
}
