"use client";

import { useState, useTransition } from "react";
import { Edit3, Check, X, Loader2 } from "lucide-react";
import { updateClientCommission } from "./actions";

interface Props {
  clientId: string;
  packageId: string | null;
  trainerName: string | null;
  currentType: "fixed_monthly" | "percentage" | null;
  currentValue: number | null;
  packageAmount: number;
  startDate: string | null;
  endDate: string | null;
  packageName: string | null;
  /** Fallback trainer-level rule (for display only when no package rule set) */
  trainerDefaultType: string | null;
  trainerDefaultValue: number | null;
}

function calcDurationMonths(startDate: string, endDate: string | null): number {
  if (!endDate) return 1;
  const [sy, sm] = startDate.split("-").map(Number);
  const [ey, em] = endDate.split("-").map(Number);
  return Math.max(1, (ey - sy) * 12 + (em - sm) + 1);
}

function calcMonthlyPayout(
  type: "fixed_monthly" | "percentage" | null,
  value: number | null,
  packageAmount: number,
  startDate: string | null,
  endDate: string | null
): number | null {
  if (type == null || value == null || value <= 0) return null;
  const duration = calcDurationMonths(startDate ?? "", endDate);
  const monthlyValue = packageAmount / duration;
  if (type === "percentage") return Math.round((monthlyValue * value) / 100 * 100) / 100;
  return value; // fixed_monthly
}

export function ClientCommissionEditor({
  clientId,
  packageId,
  trainerName,
  currentType,
  currentValue,
  packageAmount,
  startDate,
  endDate,
  packageName,
  trainerDefaultType,
  trainerDefaultValue,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [selectedType, setSelectedType] = useState<"fixed_monthly" | "percentage" | null>(
    currentType ?? null
  );
  const [inputValue, setInputValue] = useState<string>(
    currentValue != null ? String(currentValue) : ""
  );
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  const hasPackageRule = currentType != null && currentValue != null;
  const isUsingDefault = !hasPackageRule && (trainerDefaultType != null);

  // Effective rule for display
  const displayType = hasPackageRule ? currentType : trainerDefaultType as any;
  const displayValue = hasPackageRule ? currentValue : trainerDefaultValue;

  const duration = calcDurationMonths(startDate ?? "", endDate);
  const monthlyPackageValue = packageAmount > 0 ? Math.round((packageAmount / duration) * 100) / 100 : 0;

  const monthlyPayout = calcMonthlyPayout(
    displayType,
    displayValue,
    packageAmount,
    startDate,
    endDate
  );

  // Preview for edit form
  const previewPayout = calcMonthlyPayout(
    selectedType,
    parseFloat(inputValue) || null,
    packageAmount,
    startDate,
    endDate
  );

  function handleCancel() {
    setEditing(false);
    setSelectedType(currentType ?? null);
    setInputValue(currentValue != null ? String(currentValue) : "");
    setError("");
  }

  function handleSave() {
    if (!packageId) { setError("No active package found."); return; }

    if (selectedType !== null) {
      const val = parseFloat(inputValue);
      if (isNaN(val) || val < 0) { setError("Enter a valid non-negative number."); return; }
      if (selectedType === "percentage" && val > 100) { setError("Percentage cannot exceed 100."); return; }

      setError("");
      startTransition(async () => {
        try {
          await updateClientCommission(clientId, selectedType, val);
          setEditing(false);
        } catch (e: any) {
          setError(e.message ?? "Failed to save.");
        }
      });
    } else {
      // Saving "None" — clear the package-level rule
      setError("");
      startTransition(async () => {
        try {
          await updateClientCommission(clientId, null, null);
          setEditing(false);
        } catch (e: any) {
          setError(e.message ?? "Failed to save.");
        }
      });
    }
  }

  const fmt = (n: number) =>
    n.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 2 });

  if (!packageId) {
    return (
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
        <div className="text-xs text-[#6B6E67]">No active package — commission not applicable</div>
      </div>
    );
  }

  return (
    <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs font-semibold text-[#6B6E67] uppercase tracking-wider mb-0.5">
            Trainer Commission
          </div>
          {trainerName && (
            <div className="text-sm font-medium text-[#E8EBE4]">{trainerName}</div>
          )}
        </div>
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
          hasPackageRule
            ? "bg-[#B9E84A]/10 text-[#B9E84A] border-[#B9E84A]/30"
            : isUsingDefault
            ? "bg-[#2E3129] text-[#9B9E96] border-[#2E3129]"
            : "bg-orange-500/10 text-orange-400 border-orange-500/30"
        }`}>
          {hasPackageRule ? "PACKAGE-SPECIFIC" : isUsingDefault ? "TRAINER DEFAULT" : "NO RULE"}
        </span>
      </div>

      {!editing ? (
        <>
          {/* Commission display */}
          <div className="space-y-2.5">
            {displayType && displayValue != null ? (
              <>
                <div className="flex items-baseline justify-between">
                  <span className="text-xs text-[#9B9E96]">Commission</span>
                  <span className="text-sm font-semibold text-[#E8EBE4]">
                    {displayType === "percentage"
                      ? `${displayValue}% of monthly value`
                      : `₹${fmt(displayValue)} / month`}
                  </span>
                </div>

                {packageAmount > 0 && (
                  <>
                    {duration > 1 && (
                      <div className="flex items-baseline justify-between">
                        <span className="text-xs text-[#9B9E96]">
                          Monthly package value
                          <span className="text-[10px] text-[#4A4D47] ml-1">
                            ₹{fmt(packageAmount)}/{duration}mo
                          </span>
                        </span>
                        <span className="text-xs font-medium text-[#E8EBE4]">
                          ₹{fmt(monthlyPackageValue)}/mo
                        </span>
                      </div>
                    )}

                    <div className="flex items-baseline justify-between pt-2 border-t border-[#2E3129]">
                      <span className="text-xs font-semibold text-[#E8EBE4]">Monthly Payout</span>
                      <span className="text-base font-bold text-[#B9E84A]">
                        {monthlyPayout != null ? `₹${fmt(monthlyPayout)}` : "—"}
                      </span>
                    </div>
                  </>
                )}
              </>
            ) : (
              <div className="text-xs text-orange-400">
                No commission rule set.{" "}
                {!hasPackageRule && !isUsingDefault && "Set a trainer-default rule or click Edit."}
              </div>
            )}
          </div>

          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg border border-[#2E3129] text-xs font-medium text-[#9B9E96] hover:bg-[#1A1C18] hover:text-[#E8EBE4] transition-colors"
          >
            <Edit3 size={11} /> Edit Commission
          </button>
        </>
      ) : (
        /* Edit form */
        <div className="space-y-4">
          {/* Type selector */}
          <div>
            <div className="text-xs font-medium text-[#9B9E96] mb-2">Commission Type</div>
            <div className="flex gap-2 flex-wrap">
              {(["fixed_monthly", "percentage"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSelectedType(t);
                    setInputValue(t === selectedType ? inputValue : "");
                  }}
                  className={`flex-1 h-9 rounded-lg border text-xs font-medium transition-colors ${
                    selectedType === t
                      ? "bg-[#B9E84A]/10 border-[#B9E84A] text-[#B9E84A]"
                      : "bg-[#1A1C18] border-[#2E3129] text-[#9B9E96] hover:border-[#E8EBE4]"
                  }`}
                >
                  {t === "fixed_monthly" ? "Fixed Monthly (₹)" : "Percentage (%)"}
                </button>
              ))}
              <button
                type="button"
                onClick={() => { setSelectedType(null); setInputValue(""); }}
                className={`h-9 px-3 rounded-lg border text-xs font-medium transition-colors ${
                  selectedType === null
                    ? "bg-[#2E3129] border-[#4A4D47] text-[#9B9E96]"
                    : "bg-[#1A1C18] border-[#2E3129] text-[#4A4D47] hover:border-[#6B6E67]"
                }`}
              >
                None
              </button>
            </div>
            {selectedType === null && (
              <p className="text-[10px] text-[#6B6E67] mt-1.5">
                Clears the package-specific rule. Payout will fall back to the trainer&apos;s default commission.
              </p>
            )}
          </div>

          {/* Value input */}
          {selectedType !== null && (
            <div>
              <div className="text-xs font-medium text-[#9B9E96] mb-1.5">
                {selectedType === "fixed_monthly" ? "Monthly Amount (₹)" : "Percentage (%)"}
              </div>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#6B6E67]">
                  {selectedType === "fixed_monthly" ? "₹" : "%"}
                </span>
                <input
                  type="number"
                  min="0"
                  max={selectedType === "percentage" ? "100" : undefined}
                  step="0.01"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder={selectedType === "fixed_monthly" ? "e.g. 2000" : "e.g. 20"}
                  className="w-full pl-7 pr-3 h-10 bg-[#1A1C18] border border-[#2E3129] rounded-lg text-sm text-[#E8EBE4] placeholder-[#4A4D47] focus:outline-none focus:border-[#B9E84A]"
                />
              </div>
            </div>
          )}

          {/* Live preview */}
          {packageAmount > 0 && parseFloat(inputValue) > 0 && (
            <div className="bg-[#1A1C18] rounded-lg p-3 space-y-1.5 text-xs">
              <div className="text-[#6B6E67] font-semibold uppercase tracking-wide text-[10px] mb-2">Preview</div>
              {packageName && (
                <div className="flex justify-between">
                  <span className="text-[#9B9E96]">Package</span>
                  <span className="text-[#E8EBE4]">{packageName}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#9B9E96]">Package Amount</span>
                <span className="text-[#E8EBE4]">₹{fmt(packageAmount)}</span>
              </div>
              {duration > 1 && (
                <div className="flex justify-between">
                  <span className="text-[#9B9E96]">Duration</span>
                  <span className="text-[#E8EBE4]">{duration} months</span>
                </div>
              )}
              {duration > 1 && (
                <div className="flex justify-between">
                  <span className="text-[#9B9E96]">Monthly Package Value</span>
                  <span className="text-[#E8EBE4]">₹{fmt(monthlyPackageValue)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-[#9B9E96]">
                  {selectedType === "percentage" ? `${inputValue}% commission` : "Fixed monthly"}
                </span>
                <span className="text-[#E8EBE4]">
                  {selectedType === "percentage"
                    ? `${inputValue}% × ₹${fmt(monthlyPackageValue)}`
                    : `₹${fmt(parseFloat(inputValue) || 0)}`}
                </span>
              </div>
              <div className="flex justify-between pt-1.5 border-t border-[#2E3129] font-semibold">
                <span className="text-[#E8EBE4]">Monthly Payout</span>
                <span className="text-[#B9E84A]">
                  {previewPayout != null ? `₹${fmt(previewPayout)}` : "—"}
                </span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-400">{error}</p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={isPending}
              className="flex items-center gap-1.5 h-9 px-4 rounded-lg border border-[#2E3129] text-xs font-medium text-[#9B9E96] hover:bg-[#1A1C18] transition-colors disabled:opacity-50"
            >
              <X size={12} /> Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isPending || (selectedType !== null && !inputValue)}
              className="flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg bg-[#B9E84A] text-[#171917] text-xs font-semibold hover:bg-[#A8D63A] transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <><Loader2 size={12} className="animate-spin" /> Saving…</>
              ) : (
                <><Check size={12} /> Save Changes</>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
