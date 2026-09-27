"use client";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { formatTime } from "@/lib/utils";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SlotData {
  time: string;
  current: number;
  max: number;
  isWorking: boolean;
  isBlocked: boolean;
  clients: string[];
}

interface TrainerRow {
  trainer: {
    id: string;
    first_name: string;
    last_name: string;
    profile_picture_url: string | null;
    max_clients_per_slot: number;
    status: string;
  };
  isOnLeave: boolean;
  slots: SlotData[];
}

interface ScheduleGridProps {
  date: string;
  slots: string[];
  gridData: TrainerRow[];
}

function SlotCell({ slot, isOnLeave }: { slot: SlotData; isOnLeave: boolean }) {
  if (!slot.isWorking) {
    return (
      <div className="h-16 rounded-lg bg-[#1A1C18] border border-dashed border-[#2E3129] flex items-center justify-center">
        <span className="text-[10px] text-[#6B6E67]">—</span>
      </div>
    );
  }

  if (isOnLeave) {
    return (
      <div className="h-16 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[10px] font-semibold text-yellow-400">LEAVE</span>
      </div>
    );
  }

  if (slot.isBlocked) {
    return (
      <div className="h-16 rounded-lg bg-[#2E3129] border border-[#3A3D35] flex items-center justify-center">
        <span className="text-[10px] font-medium text-[#6B6E67]">BLOCKED</span>
      </div>
    );
  }

  const isFull = slot.current >= slot.max;
  const ratio = slot.max > 0 ? slot.current / slot.max : 0;

  let bg = "bg-[#B9E84A]/12 border-[#B9E84A]/35";
  let textColor = "text-[#3D6005]";
  let capacityText = `${slot.current}/${slot.max}`;

  if (isFull) {
    bg = "bg-red-500/10 border-red-500/30";
    textColor = "text-red-400";
  } else if (ratio >= 0.5) {
    bg = "bg-orange-500/10 border-orange-500/30";
    textColor = "text-orange-400";
  }

  return (
    <div className={`h-16 rounded-lg border ${bg} flex flex-col items-center justify-center gap-1 px-2 cursor-pointer hover:opacity-80 transition-opacity`}>
      <span className={`text-base font-bold tabular-nums ${textColor}`}>
        {capacityText}
      </span>
      {slot.clients.length > 0 && (
        <div className="flex flex-wrap gap-0.5 justify-center max-w-full">
          {slot.clients.slice(0, 3).map((name, i) => (
            <span key={i} className="text-[9px] text-[#6B6E67] bg-[#222520]/60 rounded px-1 truncate max-w-[48px]">
              {name}
            </span>
          ))}
          {slot.clients.length > 3 && (
            <span className="text-[9px] text-[#6B6E67]">+{slot.clients.length - 3}</span>
          )}
        </div>
      )}
      {slot.current === 0 && slot.max > 0 && (
        <span className="text-[9px] text-[#6B6E67]">{slot.max} available</span>
      )}
    </div>
  );
}

export function ScheduleGrid({ date, slots, gridData }: ScheduleGridProps) {
  const router = useRouter();

  function changeDate(delta: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    router.push(`/manager/schedule?date=${d.toISOString().split("T")[0]}`);
  }

  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Show only slots between 6am-10pm for cleanliness
  const filteredSlots = slots.filter(s => {
    const h = parseInt(s.split(":")[0]);
    return h >= 5 && h <= 22;
  });

  return (
    <div className="space-y-4">
      {/* Date navigator */}
      <div className="flex items-center justify-between bg-[#222520] border border-[#2E3129] rounded-xl px-4 py-3">
        <button
          onClick={() => changeDate(-1)}
          className="w-8 h-8 rounded-lg border border-[#2E3129] flex items-center justify-center hover:bg-[#1A1C18] transition-colors"
        >
          <ChevronLeft size={15} />
        </button>
        <div className="text-sm font-medium text-[#E8EBE4]">{displayDate}</div>
        <button
          onClick={() => changeDate(1)}
          className="w-8 h-8 rounded-lg border border-[#2E3129] flex items-center justify-center hover:bg-[#1A1C18] transition-colors"
        >
          <ChevronRight size={15} />
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-[#6B6E67]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#B9E84A]/30 border border-[#B9E84A]/50" />
          Available
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500/20 border border-orange-500/40" />
          Partially Full
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500/20 border border-red-500/40" />
          Full
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500/20 border border-yellow-500/40" />
          On Leave
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-[#2E3129] border border-[#3A3D35] border-dashed" />
          Not Working
        </div>
      </div>

      {/* Grid */}
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full" style={{ minWidth: Math.max(600, filteredSlots.length * 90 + 180) }}>
            <thead>
              <tr className="border-b border-[#1A1C18]">
                <th className="sticky left-0 bg-[#222520] text-left px-5 py-3.5 text-[11px] font-semibold text-[#6B6E67] w-44 z-10">
                  TRAINER
                </th>
                {filteredSlots.map(slot => (
                  <th
                    key={slot}
                    className="text-center px-2 py-3.5 text-[11px] font-semibold text-[#6B6E67] min-w-[84px]"
                  >
                    {formatTime(slot)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {gridData.map(({ trainer, isOnLeave, slots: trainerSlots }) => (
                <tr key={trainer.id} className="border-b border-[#1A1C18] last:border-0">
                  <td className="sticky left-0 bg-[#222520] px-5 py-2.5 z-10">
                    <div className="flex items-center gap-2.5">
                      <Avatar
                        firstName={trainer.first_name}
                        lastName={trainer.last_name}
                        src={trainer.profile_picture_url}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[#E8EBE4] truncate">
                          {trainer.first_name} {trainer.last_name}
                        </div>
                        <div className="text-[10px] text-[#6B6E67]">
                          max {trainer.max_clients_per_slot}/slot
                        </div>
                      </div>
                    </div>
                  </td>
                  {filteredSlots.map(slotTime => {
                    const slot = trainerSlots.find(s => s.time === slotTime);
                    if (!slot) {
                      return (
                        <td key={slotTime} className="px-2 py-2.5">
                          <div className="h-16 rounded-lg bg-[#1A1C18] border border-dashed border-[#2E3129]" />
                        </td>
                      );
                    }
                    return (
                      <td key={slotTime} className="px-2 py-2.5">
                        <SlotCell slot={slot} isOnLeave={isOnLeave} />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
          {gridData.length === 0 && (
            <div className="py-16 text-center text-sm text-[#6B6E67]">
              No active trainers. Add trainers to see their schedule.
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {gridData.map(({ trainer, slots: ts, isOnLeave }) => {
          const workingSlots = ts.filter(s => s.isWorking && !s.isBlocked && !isOnLeave);
          const totalCap = workingSlots.reduce((s, sl) => s + sl.max, 0);
          const totalUsed = workingSlots.reduce((s, sl) => s + sl.current, 0);
          const pct = totalCap > 0 ? Math.round((totalUsed / totalCap) * 100) : 0;

          return (
            <div key={trainer.id} className="bg-[#222520] border border-[#2E3129] rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-2">
                <Avatar firstName={trainer.first_name} lastName={trainer.last_name} size="xs" />
                <span className="text-xs font-medium text-[#E8EBE4]">{trainer.first_name}</span>
              </div>
              {isOnLeave ? (
                <span className="text-xs text-yellow-600 font-medium">On Leave</span>
              ) : (
                <>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#6B6E67]">Utilization</span>
                    <span className="font-semibold text-[#E8EBE4]">{pct}%</span>
                  </div>
                  <div className="h-1.5 bg-[#222520] rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 90 ? "bg-red-400" : pct >= 60 ? "bg-amber-400" : "bg-[#B9E84A]"}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] text-[#6B6E67] mt-1">{totalUsed}/{totalCap} slots</div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}