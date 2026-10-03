"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { generatePayoutsForMonth } from "./actions";
import { Loader2 } from "lucide-react";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

interface Props {
  month: number;
  year: number;
}

/**
 * Fires generatePayoutsForMonth exactly once per mount when the server
 * determines the month needs auto-generation (empty or all-draft).
 * Shows a non-blocking banner while running, then calls router.refresh()
 * so the server re-fetches the updated records.
 *
 * This component must never be rendered when the month contains any
 * reviewed/approved/paid record — that guard lives in the server page.
 */
export function PayoutAutoGenerate({ month, year }: Props) {
  const router = useRouter();
  const [running, setRunning] = useState(true);
  const [error, setError] = useState("");
  const fired = useRef(false); // prevent double-firing in StrictMode

  useEffect(() => {
    if (fired.current) return;
    fired.current = true;

    generatePayoutsForMonth(month, year)
      .then(() => {
        router.refresh();
      })
      .catch((e: any) => {
        setError(e?.message ?? "Auto-generation failed");
        setRunning(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="flex items-center gap-2 text-xs text-red-400 px-1">
        <span>{error}</span>
      </div>
    );
  }

  if (!running) return null;

  return (
    <div className="flex items-center gap-2 text-xs text-[#9B9E96] px-1">
      <Loader2 size={12} className="animate-spin text-[#B9E84A]" />
      Updating {MONTH_NAMES[month - 1]} {year} payouts…
    </div>
  );
}
