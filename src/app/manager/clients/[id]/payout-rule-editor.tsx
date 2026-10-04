"use client";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { DollarSign } from "lucide-react";

interface Props {
  packageId: string;
  gymId: string;
  payoutType: string | null;
  payoutValue: number | null;
  packageAmount: number | null;
  packageName: string | null;
  startDate: string | null;
  endDate: string | null;
  trainerRuleType: string | null;
  trainerRuleValue: number | null;
}

function ruleLabel(type: string | null, value: number | null, fallback = false): string {
  if (!type || value == null) return fallback ? "Uses trainer default" : "Not set";
  if (type === "percentage") return `${value}% of package value`;
  if (type === "fixed_monthly") return `₹${value.toLocaleString("en-IN")}/month`;
  return `₹${value.toLocaleString("en-IN")}/package`;
}

function monthlyPreview(type: string, value: number, amount: number | null, start: string | null, end: string | null): string {
  if (type === "fixed_monthly") {
    return `₹${value.toLocaleString("en-IN")}/month`;
  }
  if (type === "percentage" && amount) {
    const monthly = Math.round((amount * value) / 100);
    return `₹${monthly.toLocaleString("en-IN")} (${value}% of ₹${amount.toLocaleString("en-IN")})`;
  }
  return "";
}

export function PayoutRuleEditor({
  packageId, gymId, payoutType, payoutValue, packageAmount,
  packageName, startDate, endDate, trainerRuleType, trainerRuleValue,
}: Props) {
  const [open, setOpen] = useState(false);
  const [type, setType] = useState(payoutType ?? "fixed_monthly");
  const [value, setValue] = useState(payoutValue != null ? String(payoutValue) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const hasPackageRule = !!(payoutType && payoutValue != null);

  async function handleSave() {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) { setError("Enter a valid amount"); return; }
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from("pt_packages")
      .update({ trainer_payout_type: type, trainer_payout_value: num } as any)
      .eq("id", packageId)
      .eq("gym_id", gymId);
    if (updateErr) { setError(updateErr.message); setSaving(false); return; }
    // Audit log
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("audit_logs").insert({
      gym_id: gymId,
      user_id: user?.id ?? null,
      action: "pt_package_payout_rule_updated",
      entity_type: "pt_packages",
      entity_id: packageId,
      new_values: { trainer_payout_type: type, trainer_payout_value: num },
    });
    setSaving(false);
    window.location.reload();
  }

  async function handleClear() {
    setSaving(true);
    setError("");
    const supabase = createClient();
    const { error: updateErr } = await supabase
      .from("pt_packages")
      .update({ trainer_payout_type: null, trainer_payout_value: null } as any)
      .eq("id", packageId)
      .eq("gym_id", gymId);
    if (updateErr) { setError(updateErr.message); setSaving(false); return; }
    setSaving(false);
    window.location.reload();
  }

  const preview = value && !isNaN(parseFloat(value))
    ? monthlyPreview(type, parseFloat(value), packageAmount, startDate, endDate)
    : "";

  return (
    <div className="pt-2 border-t border-[#2E3129]">
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5 text-[10px] text-[#6B6E67]">
          <DollarSign size={11} />
          Trainer Payout Rule
        </div>
        <div className="flex gap-2">
          {hasPackageRule && !open && (
            <button
              onClick={handleClear}
              disabled={saving}
              className="text-[10px] text-[#6B6E67] hover:text-red-400 transition-colors"
            >
              Reset to default
            </button>
          )}
          <button
            onClick={() => setOpen(!open)}
            className="text-[10px] text-[#B9E84A] hover:text-[#6D28D9] underline"
          >
            {open ? "Cancel" : "Edit"}
          </button>
        </div>
      </div>

      {!open ? (
        <div>
          {hasPackageRule ? (
            <div className="text-sm font-medium text-[#E8EBE4]">
              {ruleLabel(payoutType, payoutValue)}
              <span className="ml-2 text-[10px] text-[#B9E84A] bg-[#B9E84A]/15 border border-[#B9E84A]/20 px-1.5 py-0.5 rounded">package rule</span>
            </div>
          ) : (
            <div className="text-sm text-[#9B9E96]">
              {trainerRuleType
                ? <>{ruleLabel(trainerRuleType, trainerRuleValue)} <span className="text-[10px] text-[#6B6E67]">(trainer default)</span></>
                : <span className="text-red-400 text-xs">No rule set</span>
              }
            </div>
          )}
        </div>
      ) : (
        <div className="mt-2 bg-[#1A1C18] rounded-xl p-3 space-y-3">
          <div className="text-xs font-medium text-[#9B9E96]">
            Set Payout Rule for{packageName ? ` "${packageName}"` : " this package"}
          </div>
          <div className="flex gap-2">
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="flex-1 text-xs border border-[#2E3129] rounded-lg px-2 py-1.5 bg-[#222520] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
            >
              <option value="fixed_monthly">Fixed monthly (₹/month)</option>
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
                placeholder={type === "percentage" ? "25" : "2000"}
                min="1"
                className="w-full pl-6 pr-2 py-1.5 text-xs border border-[#2E3129] rounded-lg bg-[#222520] text-[#E8EBE4] focus:outline-none focus:border-[#B9E84A]"
              />
            </div>
          </div>
          {preview && (
            <div className="text-[11px] text-[#B9E84A] bg-[#B9E84A]/5 border border-[#B9E84A]/20 rounded-lg px-2.5 py-1.5">
              Monthly payout: {preview}
            </div>
          )}
          {error && <p className="text-xs text-red-400">{error}</p>}
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="text-xs bg-[#B9E84A] text-[#171917] font-semibold px-3 py-1.5 rounded-lg disabled:opacity-60 hover:bg-[#A3D43F]"
            >
              {saving ? "Saving…" : "Save Rule"}
            </button>
            <button
              onClick={() => { setOpen(false); setError(""); setValue(payoutValue != null ? String(payoutValue) : ""); setType(payoutType ?? "fixed_monthly"); }}
              className="text-xs border border-[#2E3129] text-[#9B9E96] px-3 py-1.5 rounded-lg hover:bg-[#2E3129]"
            >
              Cancel
            </button>
          </div>
          <p className="text-[10px] text-[#6B6E67]">
            This rule applies to this package only. Other packages use the trainer&apos;s default rule.
          </p>
        </div>
      )}
    </div>
  );
}
