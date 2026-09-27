"use client";
import { useState, useMemo } from "react";
import { Avatar } from "@/components/ui/avatar";
import { CheckCircle, XCircle, Users, ChevronRight } from "lucide-react";
import Link from "next/link";

const DAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
];

function fmtHour(h: number): string {
  if (h === 0)  return "12am";
  if (h < 12)   return `${h}am`;
  if (h === 12) return "12pm";
  return `${h - 12}pm`;
}

function slotLabel(h: number): string {
  return `${fmtHour(h)}–${fmtHour(h + 1)}`;
}

interface Trainer {
  id: string;
  first_name: string;
  last_name: string;
  profile_picture_url: string | null;
  max_clients_per_slot: number;
}

interface WorkingHour {
  trainer_id: string;
  day_of_week: number;
  is_working_day: boolean;
  start_time: string;
  end_time: string;
}

interface Assignment {
  trainer_id: string;
  days_of_week: number[];
  preferred_time: string;
}

interface Props {
  trainers: Trainer[];
  workingHours: WorkingHour[];
  assignments: Assignment[];
}

interface SlotInfo {
  hour: number;
  used: number;
  free: number;
  max: number;
}

interface TrainerResult {
  trainer: Trainer;
  status: "available" | "full" | "off";
  freeSlots: SlotInfo[];
  usedSlots: SlotInfo[];
}

export function AvailabilityFinder({ trainers, workingHours, assignments }: Props) {
  const todayDow = new Date().getDay();
  const [selectedDay, setSelectedDay] = useState(todayDow);

  const results: TrainerResult[] = useMemo(() => {
    return trainers.map(trainer => {
      const wh = workingHours.find(
        w => w.trainer_id === trainer.id && w.day_of_week === selectedDay
      );

      if (!wh || !wh.is_working_day) {
        return { trainer, status: "off" as const, freeSlots: [], usedSlots: [] };
      }

      const [sh] = wh.start_time.split(":").map(Number);
      const [eh] = wh.end_time.split(":").map(Number);
      const max = trainer.max_clients_per_slot ?? 1;

      const freeSlots: SlotInfo[] = [];
      const usedSlots: SlotInfo[] = [];

      for (let h = sh; h < eh; h++) {
        const used = assignments.filter(a => {
          if (a.trainer_id !== trainer.id) return false;
          if (!a.days_of_week?.includes(selectedDay)) return false;
          const [ah] = (a.preferred_time ?? "").split(":").map(Number);
          return ah === h;
        }).length;

        const free = Math.max(0, max - used);
        const slot: SlotInfo = { hour: h, used, free, max };
        if (free > 0) freeSlots.push(slot);
        else usedSlots.push(slot);
      }

      const status = freeSlots.length > 0 ? ("available" as const) : ("full" as const);
      return { trainer, status, freeSlots, usedSlots };
    });
  }, [selectedDay, trainers, workingHours, assignments]);

  const available = results.filter(r => r.status === "available").sort((a, b) => b.freeSlots.length - a.freeSlots.length);
  const full      = results.filter(r => r.status === "full");
  const off       = results.filter(r => r.status === "off");

  const selectedDayLabel = DAY_OPTIONS.find(d => d.value === selectedDay)?.label ?? "";

  return (
    <div className="space-y-4">
      {/* Header + day picker */}
      <div className="bg-[#222520] border border-[#2E3129] rounded-2xl p-5">
        <div className="flex flex-wrap items-center gap-4">
          <div>
            <h2 className="text-sm font-semibold text-[#E8EBE4]">Check Trainer Availability</h2>
            <p className="text-[11px] text-[#6B6E67] mt-0.5">Free time slots by day</p>
          </div>
          <div className="flex items-center gap-2 ml-auto flex-wrap">
            {DAY_OPTIONS.map(d => (
              <button
                key={d.value}
                onClick={() => setSelectedDay(d.value)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  selectedDay === d.value
                    ? "bg-[#B9E84A] text-[#171917]"
                    : "bg-[#1A1C18] border border-[#2E3129] text-[#9B9E96] hover:text-[#E8EBE4] hover:border-[#B9E84A]/40"
                }`}
              >
                {d.label.slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-medium text-[#9B9E96]">{selectedDayLabel}</span>
        <span className="text-[#3A3D35]">·</span>
        <span className="flex items-center gap-1.5 bg-[#B9E84A]/10 border border-[#B9E84A]/30 px-2.5 py-1 rounded-full">
          <CheckCircle size={10} className="text-[#B9E84A]" />
          <span className="text-[#B9E84A] font-semibold">{available.length}</span>
          <span className="text-[#B9E84A]/70">available</span>
        </span>
        <span className="flex items-center gap-1.5 bg-red-500/10 border border-red-500/25 px-2.5 py-1 rounded-full">
          <XCircle size={10} className="text-red-400" />
          <span className="text-red-400 font-semibold">{full.length}</span>
          <span className="text-red-400/70">full</span>
        </span>
        <span className="flex items-center gap-1.5 bg-[#1A1C18] border border-[#2E3129] px-2.5 py-1 rounded-full">
          <span className="text-[#6B6E67] font-semibold">{off.length}</span>
          <span className="text-[#6B6E67]">not working</span>
        </span>
      </div>

      {/* Available trainers */}
      {available.length > 0 && (
        <div className="bg-[#222520] border border-[#B9E84A]/25 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#B9E84A]/15 flex items-center gap-2">
            <CheckCircle size={13} className="text-[#B9E84A]" />
            <span className="text-sm font-semibold text-[#E8EBE4]">Available Trainers</span>
            <span className="text-xs text-[#9B9E96]">— free slots on {selectedDayLabel}</span>
          </div>
          <div className="divide-y divide-[#1A1C18]">
            {available.map(({ trainer, freeSlots, usedSlots }) => (
              <div key={trainer.id} className="px-5 py-4 hover:bg-[#1E2020]/50 transition-colors">
                <div className="flex items-center gap-3 mb-3">
                  <Avatar firstName={trainer.first_name} lastName={trainer.last_name} src={trainer.profile_picture_url} size="sm" />
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-[#E8EBE4]">
                      {trainer.first_name} {trainer.last_name}
                    </div>
                    <div className="text-[11px] text-[#9B9E96] mt-0.5">
                      {freeSlots.length} free · {usedSlots.length} booked
                    </div>
                  </div>
                  <Link
                    href={`/manager/trainers/${trainer.id}`}
                    className="flex items-center gap-1 text-xs text-[#9B9E96] hover:text-[#E8EBE4] border border-[#2E3129] px-2.5 py-1.5 rounded-lg hover:border-[#B9E84A]/40 transition-colors flex-shrink-0"
                  >
                    View <ChevronRight size={11} />
                  </Link>
                </div>

                {/* Free slot chips */}
                <div className="flex flex-wrap gap-1.5">
                  {freeSlots.map(s => (
                    <span
                      key={s.hour}
                      className="inline-flex items-center gap-1 bg-[#B9E84A]/12 border border-[#B9E84A]/35 text-[#B9E84A] text-[11px] font-medium px-2.5 py-1 rounded-lg"
                    >
                      {slotLabel(s.hour)}
                      {s.max > 1 && (
                        <span className="text-[#B9E84A]/60 text-[9px]">
                          {s.free}/{s.max}
                        </span>
                      )}
                    </span>
                  ))}
                  {usedSlots.map(s => (
                    <span
                      key={s.hour}
                      className="inline-flex items-center gap-1 bg-[#1A1C18] border border-[#2E3129] text-[#4A4D47] text-[11px] px-2.5 py-1 rounded-lg line-through decoration-[#3A3D35]"
                    >
                      {slotLabel(s.hour)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {available.length === 0 && (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl px-5 py-8 text-center">
          <div className="text-2xl mb-2">😔</div>
          <div className="text-sm font-semibold text-[#E8EBE4] mb-1">No available trainers on {selectedDayLabel}</div>
          <div className="text-xs text-[#6B6E67]">All trainers are fully booked or not working</div>
        </div>
      )}

      {/* Fully booked */}
      {full.length > 0 && (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1A1C18] flex items-center gap-2">
            <Users size={13} className="text-red-400" />
            <span className="text-sm font-semibold text-[#E8EBE4]">Fully Booked</span>
          </div>
          <div className="divide-y divide-[#1A1C18]">
            {full.map(({ trainer, usedSlots }) => (
              <div key={trainer.id} className="px-5 py-4 opacity-60">
                <div className="flex items-center gap-3 mb-2">
                  <Avatar firstName={trainer.first_name} lastName={trainer.last_name} src={trainer.profile_picture_url} size="sm" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-[#E8EBE4]">{trainer.first_name} {trainer.last_name}</div>
                    <div className="text-[11px] text-[#6B6E67]">{usedSlots.length} slots — all booked</div>
                  </div>
                  <span className="text-[10px] text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-full font-medium flex-shrink-0">FULL</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {usedSlots.map(s => (
                    <span key={s.hour} className="inline-flex items-center bg-red-500/10 border border-red-500/20 text-red-400/60 text-[11px] px-2.5 py-1 rounded-lg">
                      {slotLabel(s.hour)}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Not working */}
      {off.length > 0 && (
        <div className="bg-[#222520] border border-[#2E3129] rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-[#1A1C18]">
            <span className="text-sm font-semibold text-[#E8EBE4]">Not Working</span>
            <span className="text-xs text-[#6B6E67] ml-2">on {selectedDayLabel}</span>
          </div>
          <div className="px-5 py-3 flex flex-wrap gap-2">
            {off.map(({ trainer }) => (
              <div key={trainer.id} className="flex items-center gap-1.5 bg-[#1A1C18] border border-[#2E3129] px-2.5 py-1.5 rounded-lg opacity-50">
                <Avatar firstName={trainer.first_name} lastName={trainer.last_name} size="xs" />
                <span className="text-xs text-[#9B9E96]">{trainer.first_name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
