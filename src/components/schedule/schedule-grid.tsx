"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { formatTime } from "@/lib/utils";
import { ChevronLeft, ChevronRight, CalendarCheck, Users, TrendingUp } from "lucide-react";

export interface ClientSlotInfo {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string | null;
  assignment_id?: string;
  package_name?: string;
  sessions_total?: number;
  sessions_completed?: number;
  preferred_time?: string;
  days_of_week?: number[];
}

export interface SlotData {
  time: string;
  current: number;
  max: number;
  isWorking: boolean;
  isBlocked: boolean;
  clients: string[];
  clientDetails?: ClientSlotInfo[];
}

export interface TrainerRow {
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
  navigationBase?: string;
  onFreeSlotClick?: (trainer: TrainerRow["trainer"], time: string, available: number) => void;
  onOccupiedSlotClick?: (trainer: TrainerRow["trainer"], time: string, clients: ClientSlotInfo[]) => void;
}

function CapacityCell({
  slot,
  isOnLeave,
  onClick,
}: {
  slot: SlotData;
  isOnLeave: boolean;
  onClick?: () => void;
}) {
  if (!slot.isWorking) {
    return (
      <div className="h-14 rounded-lg bg-[#1A1C18]/60 flex items-center justify-center">
        <span className="text-[#3A3D35] text-base">·</span>
      </div>
    );
  }
  if (isOnLeave) {
    return (
      <div className="h-14 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex flex-col items-center justify-center gap-0.5">
        <span className="text-[9px] font-semibold text-yellow-500 tracking-wide">LEAVE</span>
      </div>
    );
  }
  if (slot.isBlocked) {
    return (
      <div className="h-14 rounded-lg bg-[#2E3129] border border-[#3A3D35] flex items-center justify-center">
        <span className="text-[9px] font-medium text-[#6B6E67] tracking-wide">BLOCKED</span>
      </div>
    );
  }

  const ratio = slot.max > 0 ? slot.current / slot.max : 0;
  const isFull = slot.current >= slot.max;
  const isEmpty = slot.current === 0;
  const isClickable = !!onClick;

  const { bg, numColor } = isFull
    ? { bg: "bg-red-500/10 border border-red-500/20", numColor: "text-red-400" }
    : ratio >= 0.5
    ? { bg: "bg-amber-500/10 border border-amber-500/20", numColor: "text-amber-400" }
    : { bg: "bg-[#B9E84A]/8 border border-[#B9E84A]/20", numColor: "text-[#B9E84A]" };

  return (
    <div
      onClick={onClick}
      className={`h-14 rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all ${bg} ${
        isClickable
          ? "cursor-pointer hover:brightness-125 hover:scale-[1.02] active:scale-[0.98]"
          : "cursor-default hover:brightness-110"
      }`}
    >
      <span className={`text-xl font-bold tabular-nums leading-none ${numColor}`}>
        {slot.current}
        <span className="text-sm opacity-50">/{slot.max}</span>
      </span>
      {slot.clients.length > 0 && (
        <div className="flex flex-wrap gap-px justify-center max-w-[80px]">
          {slot.clients.slice(0, 3).map((name, i) => (
            <span key={i} className="text-[8px] text-[#6B6E67] bg-[#1A1C18] rounded px-1 truncate max-w-[36px]">
              {name}
            </span>
          ))}
          {slot.clients.length > 3 && (
            <span className="text-[8px] text-[#6B6E67]">+{slot.clients.length - 3}</span>
          )}
        </div>
      )}
      {isEmpty && (
        <span className="text-[8px] text-[#4A4D47]">{isClickable ? "+ assign" : "free"}</span>
      )}
    </div>
  );
}

export function ScheduleGrid({
  date,
  slots,
  gridData,
  navigationBase = "/manager/schedule",
  onFreeSlotClick,
  onOccupiedSlotClick,
}: ScheduleGridProps) {
  const router = useRouter();
  const [highlight, setHighlight] = useState<string | null>(null);

  function changeDate(delta: number) {
    const d = new Date(date + "T00:00:00");
    d.setDate(d.getDate() + delta);
    router.push(`${navigationBase}?date=${d.toISOString().split("T")[0]}`);
  }

  const displayDate = new Date(date + "T00:00:00").toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const isToday =
    date ===
    new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

  const filteredSlots = slots.filter((s) => {
    const h = parseInt(s.split(":")[0]);
    return h >= 5 && h <= 22;
  });

  const totalSessions = gridData.reduce(
    (sum, { slots: ts }) => sum + ts.filter((s) => s.isWorking && s.current > 0).length,
    0
  );

  const fullSlots = gridData.reduce(
    (sum, { slots: ts, isOnLeave }) =>
      sum + ts.filter((s) => s.isWorking && !isOnLeave && s.current >= s.max && s.max > 0).length,
    0
  );

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-[#222520] border border-[#2E3129] rounded-2xl px-5 py-3.5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => changeDate(-1)}
            className="w-8 h-8 rounded-lg border border-[#2E3129] flex items-center justify-center hover:bg-[#1A1C18] transition-colors text-[#E8EBE4]"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            onClick={() => router.push(navigationBase)}
            className="text-xs border border-[#2E3129] text-[#9B9E96] px-3 h-8 rounded-lg hover:bg-[#1A1C18] transition-colors flex items-center gap-1.5"
          >
            <CalendarCheck size={11} /> Today
          </button>
          <button
            onClick={() => changeDate(1)}
            className="w-8 h-8 rounded-lg border border-[#2E3129] flex items-center justify-center hover:bg-[#1A1C18] transition-colors text-[#E8EBE4]"
          >
            <ChevronRight size={15} />
          </button>
          <span className="text-sm font-semibold text-[#E8EBE4] ml-1">{displayDate}</span>
          {isToday && (
            <span className="text-[9px] font-bold bg-[#B9E84A]/15 border border-[#B9E84A]/40 text-[#B9E84A] px-1.5 py-0.5 rounded tracking-wide uppercase">
              Today
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="flex items-center gap-1.5 bg-[#1A1C18] border border-[#2E3129] px-2.5 py-1 rounded-full">
            <Users size={10} className="text-[#9B9E96]" />
            <span className="text-[#E8EBE4] font-semibold">{gridData.length}</span>
            <span className="text-[#9B9E96]">trainers</span>
          </span>
          <span className="flex items-center gap-1.5 bg-[#B9E84A]/8 border border-[#B9E84A]/25 px-2.5 py-1 rounded-full">
            <TrendingUp size={10} className="text-[#B9E84A]" />
            <span className="text-[#B9E84A] font-semibold">{totalSessions}</span>
            <span className="text-[#B9E84A]/70">booked slots</span>
          </span>
          {fullSlots > 0 && (
            <span className="flex items-center gap-1.5 bg-red-500/8 border border-red-500/25 px-2.5 py-1 rounded-full">
              <span className="text-red-400 font-semibold">{fullSlots}</span>
              <span className="text-red-400/70">full</span>
            </span>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-[10px] text-[#6B6E67]">
        {[
          { bg: "bg-[#B9E84A]/25 border border-[#B9E84A]/40", label: "Available" },
          { bg: "bg-amber-500/25 border border-amber-500/40", label: "Partially full" },
          { bg: "bg-red-500/25 border border-red-500/40", label: "Full" },
          { bg: "bg-yellow-500/25 border border-yellow-500/40", label: "On leave" },
          { bg: "bg-[#1A1C18] border border-dashed border-[#3A3D35]", label: "Not working" },
        ].map(({ bg, label }) => (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`w-3 h-3 rounded ${bg}`} />
            {label}
          </div>
        ))}
        {(onFreeSlotClick || onOccupiedSlotClick) && (
          <div className="flex items-center gap-1.5 ml-2 pl-2 border-l border-[#2E3129]">
            <span className="text-[#B9E84A]/70">Click cells to assign or view clients</span>
          </div>
        )}
      </div>

      {/* Grid */}
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table
            className="w-full"
            style={{ minWidth: Math.max(640, filteredSlots.length * 96 + 200) }}
          >
            <thead>
              <tr className="bg-[#1E2020] border-b border-[#2E3129]">
                <th className="sticky left-0 bg-[#1E2020] text-left px-5 py-3.5 text-[11px] font-semibold text-[#6B6E67] tracking-wider w-48 z-10 uppercase">
                  Trainer
                </th>
                {filteredSlots.map((slot) => (
                  <th
                    key={slot}
                    onMouseEnter={() => setHighlight(slot)}
                    onMouseLeave={() => setHighlight(null)}
                    className={`text-center px-2 py-3.5 text-[11px] font-semibold transition-colors min-w-[92px] cursor-default ${
                      highlight === slot ? "text-[#B9E84A] bg-[#B9E84A]/5" : "text-[#6B6E67]"
                    }`}
                  >
                    {formatTime(slot)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#1A1C18]">
              {gridData.map(({ trainer, isOnLeave, slots: trainerSlots }) => {
                const workingSlots = trainerSlots.filter(
                  (s) => s.isWorking && !s.isBlocked && !isOnLeave
                );
                const used = workingSlots.reduce((s, sl) => s + sl.current, 0);
                const cap = workingSlots.reduce((s, sl) => s + sl.max, 0);
                const pct = cap > 0 ? Math.round((used / cap) * 100) : 0;

                return (
                  <tr key={trainer.id} className="group hover:bg-[#1E2020]/50 transition-colors">
                    <td className="sticky left-0 bg-[#222520] group-hover:bg-[#1E2020]/80 px-5 py-2.5 z-10 transition-colors">
                      <div className="flex items-center gap-2.5">
                        <Avatar
                          firstName={trainer.first_name}
                          lastName={trainer.last_name}
                          src={trainer.profile_picture_url}
                          size="sm"
                        />
                        <div className="min-w-0">
                          <Link
                            href={`/manager/trainers/${trainer.id}`}
                            className="text-xs font-semibold text-[#E8EBE4] hover:text-[#B9E84A] transition-colors truncate block"
                          >
                            {trainer.first_name} {trainer.last_name}
                          </Link>
                          <div className="flex items-center gap-2 mt-0.5">
                            {isOnLeave ? (
                              <span className="text-[9px] text-yellow-500 font-medium">On Leave</span>
                            ) : (
                              <>
                                <div className="h-1 w-14 bg-[#2E3129] rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      pct >= 90
                                        ? "bg-red-400"
                                        : pct >= 50
                                        ? "bg-amber-400"
                                        : "bg-[#B9E84A]"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-[9px] text-[#6B6E67]">{pct}%</span>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    {filteredSlots.map((slotTime) => {
                      const slot = trainerSlots.find((s) => s.time === slotTime);

                      let cellOnClick: (() => void) | undefined = undefined;
                      if (slot && slot.isWorking && !isOnLeave && !slot.isBlocked) {
                        if (slot.current > 0 && onOccupiedSlotClick) {
                          cellOnClick = () =>
                            onOccupiedSlotClick(trainer, slotTime, slot.clientDetails ?? []);
                        } else if (slot.current === 0 && onFreeSlotClick) {
                          cellOnClick = () => onFreeSlotClick(trainer, slotTime, slot.max);
                        }
                      }

                      return (
                        <td
                          key={slotTime}
                          className={`px-1.5 py-2 transition-colors ${
                            highlight === slotTime ? "bg-[#B9E84A]/3" : ""
                          }`}
                        >
                          {slot ? (
                            <CapacityCell slot={slot} isOnLeave={isOnLeave} onClick={cellOnClick} />
                          ) : (
                            <div className="h-14 rounded-lg bg-[#1A1C18]/40" />
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {gridData.length === 0 && (
            <div className="py-20 text-center text-sm text-[#6B6E67]">
              No active trainers — add trainers to see their schedule here
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
