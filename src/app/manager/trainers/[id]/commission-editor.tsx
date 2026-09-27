"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface Props {
  trainerId: string;
  gymId: string;
  commissionType: string | null;
  commissionValue: number | null;
  commissionRuleId: string | null;
}

export function CommissionEditor({ trainerId, gymId, commissionType, commissionValue, commissionRuleId }: Props) {
  const [editing, setEditing] = useState(false);
  const [type, setType] = useState(commissionType ?? "fixed_per_session");
  const [value, setValue] = useState(String(commissionValue ?? ""));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const displayText = commissionType
    ? commissionType === "percentage"
      ? `${commissionValue}% of session revenue`
      : `₹${(commissionValue ?? 0).toLocaleString("en-IN")}/session`
    : "Not set";

  const handleSave = async () => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true);
    setError("");

    const supabase = createClient();
    const today = new Date().toISOString().split("T")[0];
    const now = new Date();
    const month = now.getMonth() + 1;
    const year = now.getFullYear();

    // End current rule if one exists
    if (commissionRuleId) {
      await supabase
        .from("trainer_commission_rules")
        .update({ effective_to: today })
        .eq("id", commissionRuleId);
    }

    // Also end any other open rules (handles the duplicate Chakri case)
    await supabase
      .from("trainer_commission_rules")
      .update({ effective_to: today })
      .eq("trainer_id", trainerId)
      .is("effective_to", null);

    // Insert new rule
    const { error: insertErr } = await supabase.from("trainer_commission_rules").insert({
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

    // Regenerate current month payout
    await supabase
      .from("trainer_payouts")
      .delete()
      .eq("trainer_id", trainerId)
      .eq("period_month", month)
      .eq("period_year", year);

    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    const periodStart = `${year}-${String(month).padStart(2, "0")}-01`;
    const periodEnd = `${nextYear}-${String(nextMonth).padStart(2, "0")}-01`;

    const { data: sessions } = await supabase
      .from("pt_sessions")
      .select("session_revenue")
      .eq("trainer_id", trainerId)
      .eq("status", "completed")
      .gte("session_date", periodStart)
      .lt("session_date", periodEnd);

    if (sessions && sessions.length > 0) {
      const eligible_revenue = sessions.reduce((s: number, r: any) => s + (r.session_revenue ?? 0), 0);
      const calculated_payout =
        type === "percentage"
          ? (eligible_revenue * num) / 100
          : sessions.length * num;

      await supabase.from("trainer_payouts").insert({
        gym_id: gymId,
        trainer_id: trainerId,
        period_month: month,
        period_year: year,
        completed_sessions: sessions.length,
        eligible_revenue: Math.round(eligible_revenue * 100) / 100,
        commission_type: type,
        commission_value: num,
        calculated_payout: Math.round(calculated_payout * 100) / 100,
        final_payout: Math.round(calculated_payout * 100) / 100,
        status: "draft",
      });
    }

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
          onChange={e => setType(e.target.value)}
          className="flex-1 text-xs border border-[#2E3129] rounded-lg px-2 py-1.5 bg-[#222520] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
        >
          <option value="fixed_per_session">Fixed per session (₹)</option>
          <option value="percentage">Percentage of session revenue (%)</option>
        </select>
        <div className="relative w-28">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs text-[#9B9E96]">
            {type === "percentage" ? "%" : "₹"}
          </span>
          <input
            type="number"
            value={value}
            onChange={e => setValue(e.target.value)}
            placeholder={type === "percentage" ? "25" : "2500"}
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
          onClick={() => { setEditing(false); setError(""); setValue(String(commissionValue ?? "")); setType(commissionType ?? "fixed_per_session"); }}
          className="text-xs border border-[#2E3129] text-[#9B9E96] px-3 py-1.5 rounded-lg hover:bg-[#2E3129]"
        >
          Cancel
        </button>
      </div>
      <p className="text-[10px] text-[#6B6E67]">Saves new commission rule and recalculates current month payout</p>
    </div>
  );
}
