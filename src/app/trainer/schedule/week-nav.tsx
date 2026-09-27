"use client";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function WeekNav({ weekStart }: { weekStart: string }) {
  const router = useRouter();

  function shift(delta: number) {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + delta * 7);
    router.push(`/trainer/schedule?week=${d.toISOString().split("T")[0]}`);
  }

  function goToday() {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
    const d = new Date(today + "T00:00:00");
    const dow = d.getDay();
    const diff = dow === 0 ? -6 : 1 - dow;
    d.setDate(d.getDate() + diff);
    router.push(`/trainer/schedule?week=${d.toISOString().split("T")[0]}`);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => shift(-1)}
        className="w-8 h-8 rounded-lg border border-[#2E3129] flex items-center justify-center hover:bg-[#1A1C18] transition-colors text-[#E8EBE4]"
      >
        <ChevronLeft size={15} />
      </button>
      <button
        onClick={goToday}
        className="text-xs border border-[#2E3129] text-[#9B9E96] px-3 h-8 rounded-lg hover:bg-[#1A1C18] transition-colors"
      >
        This week
      </button>
      <button
        onClick={() => shift(1)}
        className="w-8 h-8 rounded-lg border border-[#2E3129] flex items-center justify-center hover:bg-[#1A1C18] transition-colors text-[#E8EBE4]"
      >
        <ChevronRight size={15} />
      </button>
    </div>
  );
}
